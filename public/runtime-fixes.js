(() => {
  "use strict";

  if (window.WATTZAN_RUNTIME_FIXES?.installed) return;

  const nativeFetch = window.fetch.bind(window);
  const TRANSIENT_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
  const CHAT_MESSAGE_PATH = "/api/chatbot/message";
  const CHAT_STATUS_PATH = "/api/chatbot/status";
  const HEALTH_PATH = "/api/health";
  const MAX_CHAT_ATTEMPTS = 3;
  const MAX_STATUS_ATTEMPTS = 2;
  const RETRY_DELAYS_MS = [650, 1500];

  const runtime = window.WATTZAN_RUNTIME_FIXES = {
    installed: true,
    version: "16.3.1-runtime-1",
    installedAt: new Date().toISOString(),
    chatbotRetries: 0,
    backendWarmups: 0,
    touchSelectionsBridged: 0,
  };

  function requestUrl(input) {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.href;
    if (typeof Request !== "undefined" && input instanceof Request) return input.url;
    return "";
  }

  function requestPath(input) {
    try {
      return new URL(requestUrl(input), window.location.href).pathname;
    } catch (_) {
      return "";
    }
  }

  function isChatRequest(input) {
    const path = requestPath(input);
    return path === CHAT_MESSAGE_PATH || path === CHAT_STATUS_PATH;
  }

  function maxAttemptsFor(input) {
    return requestPath(input) === CHAT_MESSAGE_PATH ? MAX_CHAT_ATTEMPTS : MAX_STATUS_ATTEMPTS;
  }

  function retryAfterMs(response, fallbackMs) {
    const header = response?.headers?.get?.("Retry-After");
    if (!header) return fallbackMs;
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, fallbackMs), 4000);
    const when = Date.parse(header);
    if (Number.isFinite(when)) return Math.min(Math.max(when - Date.now(), fallbackMs), 4000);
    return fallbackMs;
  }

  function abortableDelay(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason || new DOMException("Aborted", "AbortError"));
        return;
      }
      const timer = window.setTimeout(done, ms);
      function done() {
        cleanup();
        resolve();
      }
      function abort() {
        cleanup();
        reject(signal.reason || new DOMException("Aborted", "AbortError"));
      }
      function cleanup() {
        window.clearTimeout(timer);
        signal?.removeEventListener?.("abort", abort);
      }
      signal?.addEventListener?.("abort", abort, { once: true });
    });
  }

  /*
    Chat reliability layer.
    The existing WATTZAN request remains unchanged; only transient connection,
    rate-limit, and gateway/server failures are retried automatically. Normal
    4xx validation/configuration errors are returned immediately.
  */
  window.fetch = async function wattzanReliableFetch(input, init = {}) {
    if (!isChatRequest(input)) return nativeFetch(input, init);

    const attempts = maxAttemptsFor(input);
    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (init?.signal?.aborted) {
        throw init.signal.reason || new DOMException("Aborted", "AbortError");
      }

      try {
        const response = await nativeFetch(input, init);
        const retryable = TRANSIENT_HTTP_STATUS.has(response.status);
        if (!retryable || attempt === attempts) return response;

        runtime.chatbotRetries += 1;
        const fallback = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
        await abortableDelay(retryAfterMs(response, fallback), init?.signal);
      } catch (error) {
        lastError = error;
        if (init?.signal?.aborted || error?.name === "AbortError" || attempt === attempts) throw error;

        runtime.chatbotRetries += 1;
        const fallback = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
        await abortableDelay(fallback, init?.signal);
      }
    }

    throw lastError || new Error("WATTZAN chatbot request failed after automatic retries.");
  };

  /*
    Wake the API in the background. This is deliberately silent and does not
    block the page. It reduces the chance that the first chatbot message is the
    request that has to wake a sleeping/free backend instance.
  */
  let lastWarmAttemptAt = 0;
  let warmingPromise = null;

  async function warmBackend(force = false) {
    const now = Date.now();
    if (!force && now - lastWarmAttemptAt < 45000) return warmingPromise;
    if (warmingPromise) return warmingPromise;

    lastWarmAttemptAt = now;
    runtime.backendWarmups += 1;

    warmingPromise = (async () => {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        try {
          const response = await nativeFetch(`${HEALTH_PATH}?warm=${Date.now()}`, {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store",
            signal: controller.signal,
          });
          if (response.ok) return true;
          if (!TRANSIENT_HTTP_STATUS.has(response.status)) return false;
        } catch (_) {
          // Silent warmup: a real chatbot request will still use automatic retries.
        } finally {
          window.clearTimeout(timeout);
        }
        if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, 700 * attempt));
      }
      return false;
    })().finally(() => {
      warmingPromise = null;
    });

    return warmingPromise;
  }

  function scheduleInitialWarmup() {
    window.setTimeout(() => warmBackend(false), 120);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleInitialWarmup, { once: true });
  } else {
    scheduleInitialWarmup();
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("#assistant-launcher, [data-assistant-prompt], #assistant-popup-form, #recommendations-assistant-form")) {
      warmBackend(false);
    }
  }, true);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lastWarmAttemptAt > 5 * 60 * 1000) {
      warmBackend(true);
    }
  });

  /*
    Mobile 3D map tap bridge.
    WATTZAN's 3D map already has accurate desktop click/raycast selection.
    OrbitControls can suppress the browser's synthetic click after a touch.
    For a genuine short tap (not a drag/rotate gesture), dispatch one click at
    the same coordinates so the existing raycaster selects the municipality and
    opens the existing details popup. No map/model logic is duplicated here.
  */
  const activePointers = new Map();
  let lastNativeMapClickAt = 0;
  const TAP_MOVE_LIMIT_PX = 13;
  const TAP_MAX_DURATION_MS = 700;

  function overviewCanvasFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const canvas = target.closest("#overview-consumption-map canvas");
    return canvas instanceof HTMLCanvasElement ? canvas : null;
  }

  function pointInsideCanvas(canvas, x, y) {
    const rect = canvas.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  document.addEventListener("click", (event) => {
    if (event.__wattzanSynthetic3DTap) return;
    if (overviewCanvasFromTarget(event.target)) lastNativeMapClickAt = performance.now();
  }, true);

  if ("PointerEvent" in window) {
    document.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      const canvas = overviewCanvasFromTarget(event.target);
      if (!canvas) return;
      activePointers.set(event.pointerId, {
        canvas,
        startX: event.clientX,
        startY: event.clientY,
        startedAt: performance.now(),
        moved: false,
      });
    }, true);

    document.addEventListener("pointermove", (event) => {
      const tap = activePointers.get(event.pointerId);
      if (!tap) return;
      const distance = Math.hypot(event.clientX - tap.startX, event.clientY - tap.startY);
      if (distance > TAP_MOVE_LIMIT_PX) tap.moved = true;
    }, true);

    document.addEventListener("pointercancel", (event) => {
      activePointers.delete(event.pointerId);
    }, true);

    document.addEventListener("pointerup", (event) => {
      const tap = activePointers.get(event.pointerId);
      if (!tap) return;
      activePointers.delete(event.pointerId);

      const duration = performance.now() - tap.startedAt;
      const distance = Math.hypot(event.clientX - tap.startX, event.clientY - tap.startY);
      if (tap.moved || distance > TAP_MOVE_LIMIT_PX || duration > TAP_MAX_DURATION_MS) return;
      if (!tap.canvas.isConnected || !pointInsideCanvas(tap.canvas, event.clientX, event.clientY)) return;

      const tapCompletedAt = performance.now();
      window.setTimeout(() => {
        // If the browser already produced a native click, do nothing.
        if (lastNativeMapClickAt >= tapCompletedAt) return;
        if (!tap.canvas.isConnected) return;

        const synthetic = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: event.clientX,
          clientY: event.clientY,
          button: 0,
          buttons: 0,
        });
        Object.defineProperty(synthetic, "__wattzanSynthetic3DTap", { value: true });
        runtime.touchSelectionsBridged += 1;
        tap.canvas.dispatchEvent(synthetic);
      }, 90);
    }, true);
  }
})();
