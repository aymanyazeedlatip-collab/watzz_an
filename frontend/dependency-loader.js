(() => {
  "use strict";

  const runtime = window.WATTZAN_FRONTEND_RUNTIME = window.WATTZAN_FRONTEND_RUNTIME || {
    version: "16.3.1",
    dependencies: {},
    startedAt: new Date().toISOString(),
  };

  function mark(name, status, source = null, error = null) {
    runtime.dependencies[name] = {
      status,
      source,
      error: error ? String(error?.message || error) : null,
      checkedAt: new Date().toISOString(),
    };
  }

  function loadScript(url, timeoutMs = 4500) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let settled = false;
      const timer = window.setTimeout(() => finish(new Error(`Timed out loading ${url}`)), timeoutMs);
      const finish = (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        if (error) {
          script.remove();
          reject(error);
        } else resolve(url);
      };
      script.src = url;
      script.async = false;
      script.onload = () => finish(null);
      script.onerror = () => finish(new Error(`Failed to load ${url}`));
      document.head.appendChild(script);
    });
  }

  function loadStylesheet(url, timeoutMs = 4500) {
    return new Promise((resolve, reject) => {
      const link = document.createElement("link");
      let settled = false;
      const timer = window.setTimeout(() => finish(new Error(`Timed out loading ${url}`)), timeoutMs);
      const finish = (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        link.onload = null;
        link.onerror = null;
        if (error) {
          link.remove();
          reject(error);
        } else resolve(url);
      };
      link.rel = "stylesheet";
      link.href = url;
      link.onload = () => finish(null);
      link.onerror = () => finish(new Error(`Failed to load ${url}`));
      document.head.appendChild(link);
    });
  }

  async function ensureMobileCss() {
    const url = "/mobile.css?v=16.3.1-mobile-2";

    // Do not load the optional mobile layer on desktop-sized viewports.
    // This keeps the desktop presentation exactly on the existing stylesheet.
    if (!window.matchMedia("(max-width: 820px)").matches) {
      mark("Mobile responsive CSS", "skipped", "desktop-viewport");
      return true;
    }

    try {
      await loadStylesheet(url);
      mark("Mobile responsive CSS", "ready", "same-origin");
      return true;
    } catch (error) {
      // Mobile styling is intentionally non-critical. If this optional layer
      // fails, the existing desktop/tablet interface and all functions still run.
      mark("Mobile responsive CSS", "failed-optional", null, error);
      console.warn("[WATTZAN] Optional mobile responsive stylesheet unavailable", error);
      return false;
    }
  }

  async function ensureScript({ name, primary, fallback, test, required = false }) {
    if (test()) {
      mark(name, "ready", "preloaded");
      return true;
    }
    let primaryError = null;
    try {
      await loadScript(primary);
      if (test()) {
        mark(name, "ready", "same-origin");
        return true;
      }
      primaryError = new Error(`${name} loaded but did not expose its expected browser API`);
    } catch (error) {
      primaryError = error;
    }

    try {
      await loadScript(fallback);
      if (test()) {
        mark(name, "ready", "direct-fallback");
        return true;
      }
      throw new Error(`${name} fallback loaded but did not expose its expected browser API`);
    } catch (fallbackError) {
      mark(name, required ? "failed-required" : "failed-optional", null,
        `${primaryError?.message || primaryError}; fallback: ${fallbackError?.message || fallbackError}`);
      console.error(`[WATTZAN] ${name} dependency unavailable`, { primaryError, fallbackError });
      return false;
    }
  }

  async function ensureLeafletCss() {
    try {
      await loadStylesheet("/vendor/leaflet.css");
      mark("Leaflet CSS", "ready", "same-origin");
    } catch (primaryError) {
      try {
        await loadStylesheet("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
        mark("Leaflet CSS", "ready", "direct-fallback");
      } catch (fallbackError) {
        mark("Leaflet CSS", "failed-optional", null,
          `${primaryError?.message || primaryError}; fallback: ${fallbackError?.message || fallbackError}`);
      }
    }
  }

  async function bootstrap() {
    // Independent browser libraries are loaded concurrently. This avoids a deployment
    // waiting through a long chain of CDN timeouts before app.js is even allowed to start.
    await Promise.allSettled([
      ensureMobileCss(),
      ensureLeafletCss(),
      ensureScript({
        name: "Chart.js", primary: "/vendor/chart.umd.min.js",
        fallback: "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js",
        test: () => Boolean(window.Chart),
      }),
      ensureScript({
        name: "Hammer.js", primary: "/vendor/hammer.min.js",
        fallback: "https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js",
        test: () => Boolean(window.Hammer),
      }),
      ensureScript({
        name: "Lucide", primary: "/vendor/lucide.min.js",
        fallback: "https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js",
        test: () => Boolean(window.lucide?.createIcons),
      }),
      ensureScript({
        name: "Leaflet", primary: "/vendor/leaflet.js",
        fallback: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
        test: () => Boolean(window.L?.map),
      }),
      ensureScript({
        name: "Three.js", primary: "/vendor/three.min.js",
        fallback: "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
        test: () => Boolean(window.THREE?.WebGLRenderer), required: true,
      }),
    ]);

    // Plugins depend on their parent libraries, so load only this second wave afterward.
    await Promise.allSettled([
      ensureScript({
        name: "Chart Zoom", primary: "/vendor/chartjs-plugin-zoom.min.js",
        fallback: "https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.2.0/dist/chartjs-plugin-zoom.min.js",
        test: () => Boolean(window.Chart?.registry?.plugins?.get?.("zoom")),
      }),
      ensureScript({
        name: "OrbitControls", primary: "/vendor/OrbitControls.js",
        fallback: "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js",
        test: () => Boolean(window.THREE?.OrbitControls), required: true,
      }),
    ]);

    runtime.finishedAt = new Date().toISOString();
    window.dispatchEvent(new CustomEvent("wattzan:dependencies-ready", { detail: runtime }));
    await loadScript("/app.js?v=16.3.1", 12000);
  }

  bootstrap().catch(async (error) => {
    runtime.bootstrapError = String(error?.message || error);
    console.error("[WATTZAN] Frontend dependency bootstrap failed", error);
    // The application is intentionally still started. It contains graceful
    // fallbacks so non-3D/API functions remain usable when a visual library fails.
    try { await loadScript("/app.js?v=16.3.1", 12000); } catch (appError) {
      console.error("[WATTZAN] Application script could not be loaded", appError);
    }
  });
})();
