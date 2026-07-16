(() => {
  "use strict";

  const API_BASE = "/api";
  const API_TIMEOUT_MS = 45000;
  const SYNTHETIC_WARNING = "Research-grade synthetic development data. Not official observed utility data.";
  const PAGE_TITLES = {
    overview: "Overview",
    forecast: "Short-term Forecast",
    "long-term-forecast": "Long-term Forecast",
    "data-management": "Data Management",
    "model-performance": "Model Performance",
    recommendations: "Recommendations",
    "forecast-history": "Forecast History",
    "system-information": "System Health",
    about: "About",
  };

  const COLORS = {
    // Same chart color families as before, with higher brightness and saturation.
    navy: "#1769AA",
    blue: "#2F86D5",
    blue2: "#55A6ED",
    purple: "#8063F4",
    paleBlue: "#EAF4FD",
    border: "#D6DEE8",
    muted: "#667382",
    success: "#35B85A",
    elevated: "#F0B429",
    high: "#FF7A1A",
    critical: "#F04444",
    gray: "#A1ADBA",
  };

  const PROVINCE_2024_POPULATION = 863651;
  const PROVINCE_POPULATION_GROWTH_PCT = 0.28;
  const LONG_TERM_SCENARIO_SPREAD_PCT = 2.0;
  const SULTAN_KUDARAT_BOUNDS = [[5.95, 123.88], [6.98, 125.18]];
  const MUNICIPALITIES = [
    { name: "Bagumbayan", population: 69830, type: "Municipality", lat: 6.5404, lng: 124.5669 },
    { name: "Columbio", population: 33337, type: "Municipality", lat: 6.6318, lng: 124.9742 },
    { name: "Esperanza", population: 73822, type: "Municipality", lat: 6.7225, lng: 124.5206 },
    { name: "Isulan", population: 101455, type: "Municipality", lat: 6.6323, lng: 124.5978 },
    { name: "Kalamansig", population: 52257, type: "Municipality", lat: 6.5521, lng: 124.0512 },
    { name: "Lebak", population: 93312, type: "Municipality", lat: 6.6300, lng: 124.0700 },
    { name: "Lutayan", population: 65425, type: "Municipality", lat: 6.5594, lng: 124.8586 },
    { name: "Lambayong", population: 81288, type: "Municipality", lat: 6.8078, lng: 124.6307 },
    { name: "Palimbang", population: 83633, type: "Municipality", lat: 6.3547, lng: 124.1900 },
    { name: "President Quirino", population: 44344, type: "Municipality", lat: 6.6982, lng: 124.7402 },
    { name: "Senator Ninoy Aquino", population: 48003, type: "Municipality", lat: 6.4594, lng: 124.3221 },
    { name: "Tacurong City", population: 116945, type: "Component City", lat: 6.6884, lng: 124.6786 },
  ];
  const MUNICIPALITY_ALIASES = new Map([
    ["city of tacurong", "Tacurong City"],
    ["tacurong", "Tacurong City"],
    ["sen. ninoy aquino", "Senator Ninoy Aquino"],
    ["sen ninoy aquino", "Senator Ninoy Aquino"],
    ["senator ninoy aquino", "Senator Ninoy Aquino"],
    ["pres. quirino", "President Quirino"],
    ["president quirino", "President Quirino"],
  ]);

  const OVERVIEW_MAP_ASSET = "/assets/sultan-kudarat-municipalities.json";
  const OVERVIEW_MAP_VIEWBOX = { width: 920, height: 640 };
  const OVERVIEW_MAP_COLORS = ["#ffffff", "#bfdbfe", "#60a5fa", "#3b82f6", "#2563eb", "#3451d1", "#4f46e5"];
  const SVG_NS = "http://www.w3.org/2000/svg";
  const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
  const OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
  const OPEN_METEO_DAILY_FIELDS = ["temperature_2m_mean", "temperature_2m_min", "temperature_2m_max", "apparent_temperature_mean", "relative_humidity_2m_mean", "precipitation_sum", "wind_speed_10m_mean", "cloud_cover_mean"];
  // Open-Meteo's historical archive (ERA5) is normally 5-7 days behind real time. Requesting
  // very recent dates from it can return null values or a rejected request. Recent dates are
  // routed to the forecast endpoint instead, which keeps a reliable rolling history window.
  const OPEN_METEO_RECENT_ARCHIVE_BUFFER_DAYS = 6;
  const OVERVIEW_3D_GAP_SCALE = 0.955;
  const ASSISTANT_REQUEST_TIMEOUT_MS = 65000;
  const ASSISTANT_WELCOME = "I can explain WATTZAN's current forecasts, model metrics, demand levels, recommendations, and municipality results. Run or select a result, then ask a question or choose a suggested prompt.";

  const state = {
    currentPage: "overview",
    health: null,
    modelStatus: null,
    performance: null,
    activeDataset: null,
    municipalityProfiles: [],
    dataSummary: null,
    history: [],
    filteredHistory: [],
    selectedFile: null,
    validation: null,
    uploadedDatasetId: null,
    latestForecastResult: null,
    forecastMode: "one-day",
    overviewMap: {
      geometry: null,
      selectedMunicipality: null,
      year: null,
      resizeTimer: null,
      renderer: null,
      scene: null,
      camera: null,
      controls: null,
      raycaster: null,
      pointer: null,
      meshes: [],
      animationFrame: null,
      renderQueued: false,
      resizeObserver: null,
      hoverMunicipality: null,
      cameraInitialized: false,
      decorations: [],
      autoRotateFrame: null,
    },
    shortTerm: {
      map: null,
      marker: null,
      selectedMunicipality: null,
      locationMethod: null,
      weatherSource: null,
      weatherDates: null,
      weatherRows: [],
      weatherLoading: false,
      weatherCache: new Map(),
    },
    longTerm: {
      map: null,
      marker: null,
      selectedMunicipality: null,
      municipalitySummary: null,
      locationMethod: null,
      projection: null,
    },
    assistant: {
      status: null,
      open: false,
      sending: false,
      transitionTimer: null,
      requestSequence: 0,
      messages: [
        { id: "assistant-welcome", role: "assistant", content: ASSISTANT_WELCOME, welcome: true },
      ],
    },
    forecastProgress: {
      depth: 0,
      hideTimer: null,
      failed: false,
    },
    charts: new Map(),
  };

  class ApiError extends Error {
    constructor(message, { code = "API_ERROR", details = null, status = 0 } = {}) {
      super(message);
      this.name = "ApiError";
      this.code = code;
      this.details = details;
      this.status = status;
    }
  }

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function setText(selectorOrElement, value, fallback = "—") {
    const element = typeof selectorOrElement === "string" ? qs(selectorOrElement) : selectorOrElement;
    if (!element) return;
    const usable = value !== null && value !== undefined && value !== "";
    element.textContent = usable ? String(value) : fallback;
  }

  function setHidden(selectorOrElement, hidden) {
    const element = typeof selectorOrElement === "string" ? qs(selectorOrElement) : selectorOrElement;
    if (!element) return;
    element.classList.toggle("hidden", hidden);
    if (hidden) element.setAttribute("aria-hidden", "true");
    else element.removeAttribute("aria-hidden");
  }

  function clearElement(element) {
    if (element) element.replaceChildren();
  }

  function createElement(tag, className = "", text = null) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== null && text !== undefined) element.textContent = String(text);
    return element;
  }

  function createIcon(iconName, className = "") {
    const icon = createElement("i", className);
    icon.setAttribute("data-lucide", iconName);
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }

  function refreshIcons(root = document) {
    if (window.lucide?.createIcons) {
      window.lucide.createIcons({ attrs: { "stroke-width": 1.8 }, root });
    }
  }

  function formatNumber(value, digits = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    return new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(numeric);
  }

  function formatCompactNumber(value, digits = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    return new Intl.NumberFormat("en-PH", {
      notation: "compact",
      maximumFractionDigits: digits,
    }).format(numeric);
  }

  function formatPercent(value, digits = 2) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${formatNumber(numeric, digits)}%` : "—";
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value.includes?.("T") ? value : `${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value, options = {}) {
    const date = parseDate(value);
    if (!date) return "—";
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: options.short ? "short" : "long",
      day: "numeric",
      timeZone: options.timeZone || "Asia/Manila",
    }).format(date);
  }

  function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) return "—";
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    }).format(date);
  }

  function parseIsoCalendarDateUtc(isoDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ""));
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day
    ) return null;
    return date;
  }

  function addDaysIso(isoDate, count) {
    const date = parseIsoCalendarDateUtc(isoDate);
    const dayCount = Number(count);
    if (!date || !Number.isInteger(dayCount)) return "";
    date.setUTCDate(date.getUTCDate() + dayCount);
    return date.toISOString().slice(0, 10);
  }

  function inclusiveDayCount(start, end) {
    const a = parseIsoCalendarDateUtc(start);
    const b = parseIsoCalendarDateUtc(end);
    if (!a || !b) return 0;
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
  }

  function buildIsoDateRange(startDate, endDate, maximumDays = 31) {
    const dayCount = inclusiveDayCount(startDate, endDate);
    if (dayCount < 1) throw new Error("The selected weather date range is invalid.");
    if (dayCount > maximumDays) {
      throw new Error(`The selected weather date range exceeds ${maximumDays} days.`);
    }
    return Array.from({ length: dayCount }, (_, index) => addDaysIso(startDate, index));
  }

  function humanize(value) {
    if (value === null || value === undefined || value === "") return "—";
    return String(value)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function normalizeList(value) {
    if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined).map(String);
    if (value === null || value === undefined || value === "") return [];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch (_) {
        // The backend may store pipe-separated values; parsing failure is expected for those.
      }
      return trimmed.split(trimmed.includes("|") ? "|" : ",").map((item) => item.trim()).filter(Boolean);
    }
    return [String(value)];
  }

  function safeNumeric(formData, name, required = false) {
    const raw = formData.get(name);
    if (raw === null || raw === "") {
      if (required) throw new Error(`${humanize(name)} is required.`);
      return undefined;
    }
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) throw new Error(`${humanize(name)} must be a valid number.`);
    return numeric;
  }

  async function loadOverviewMapGeometry() {
    const response = await fetch(OVERVIEW_MAP_ASSET, { cache: "force-cache" });
    if (!response.ok) throw new Error("The Sultan Kudarat municipality boundary file could not be loaded.");
    const payload = await response.json();
    if (!Array.isArray(payload?.features) || !payload.features.length) {
      throw new Error("The municipality boundary file does not contain usable features.");
    }
    return payload;
  }

  async function apiFetch(path, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), options.timeout || API_TIMEOUT_MS);
    const headers = new Headers(options.headers || {});
    const isFormData = options.body instanceof FormData;
    if (!isFormData && options.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Accept", "application/json");

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json() : null;
      if (!response.ok) {
        const errorPayload = payload?.error || payload?.detail || payload || {};
        const message = typeof errorPayload === "string"
          ? errorPayload
          : errorPayload.message || `Request failed with status ${response.status}.`;
        throw new ApiError(message, {
          code: errorPayload.code || "HTTP_ERROR",
          details: errorPayload.details || null,
          status: response.status,
        });
      }
      return payload;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new ApiError("The request took too long and was cancelled.", { code: "TIMEOUT" });
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError("The backend could not be reached.", {
        code: "NETWORK_ERROR",
        details: error.message,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function errorMessage(error) {
    if (!error) return "An unknown error occurred.";
    const detail = error.details ? ` ${error.details}` : "";
    return `${error.message || String(error)}${detail}`.trim();
  }

  function showToast(title, message, type = "info") {
    const region = qs("#toast-region");
    const toast = createElement("div", `toast ${type}`);
    const iconName = type === "error" ? "circle-alert" : type === "success" ? "circle-check" : "info";
    toast.appendChild(createIcon(iconName));
    const body = createElement("div");
    body.appendChild(createElement("strong", "", title));
    body.appendChild(createElement("span", "", message));
    toast.appendChild(body);
    region.appendChild(toast);
    refreshIcons(toast);
    window.setTimeout(() => toast.remove(), 5200);
  }

  function setApiConnection(connected, message = "") {
    const dot = qs("#api-status-dot");
    dot.className = `status-dot ${connected ? "good" : "bad"}`;
    setText("#top-api-status", connected ? "Connected" : "Unavailable");
    const globalError = qs("#global-error");
    globalError.classList.toggle("hidden", connected);
    if (!connected) setText("#global-error-message", message || "The backend could not be reached.");
  }

  function setModelStatus(status) {
    const dot = qs("#model-status-dot");
    const ready = Boolean(status?.production_ready);
    dot.className = `status-dot ${ready ? "good" : "warning"}`;
    setText("#top-model-status", ready ? "Production ready" : "Check models");
  }

  function setCurrentDate() {
    const formatted = new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Manila",
    }).format(new Date());
    setText("#top-current-date", formatted);
  }

  function statusClass(level) {
    const normalized = String(level || "").toLowerCase();
    return ["normal", "elevated", "high", "critical"].includes(normalized) ? normalized : "neutral";
  }

  function applyStatusBadge(element, level, fallback = "No data") {
    if (!element) return;
    const label = level || fallback;
    element.textContent = label;
    element.className = `status-badge ${statusClass(level)}`;
  }

  function chartBaseOptions({ yTitle = "", y1Title = "", showLegend = true, beginAtZero = false } = {}) {
    const scales = {
      x: {
        grid: { color: "rgba(214, 222, 232, 0.42)" },
        ticks: { color: COLORS.muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 14 },
      },
      y: {
        beginAtZero,
        grid: { color: "rgba(214, 222, 232, 0.65)" },
        ticks: { color: COLORS.muted },
        title: { display: Boolean(yTitle), text: yTitle, color: COLORS.muted },
      },
    };
    if (y1Title) {
      scales.y1 = {
        position: "right",
        beginAtZero,
        grid: { drawOnChartArea: false },
        ticks: { color: COLORS.muted },
        title: { display: true, text: y1Title, color: COLORS.muted },
      };
    }
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: showLegend,
          position: "bottom",
          labels: { color: COLORS.muted, boxWidth: 12, usePointStyle: true, padding: 16 },
        },
        tooltip: {
          backgroundColor: COLORS.navy,
          titleColor: "#FFFFFF",
          bodyColor: "#FFFFFF",
          padding: 10,
          callbacks: {
            label(context) {
              const label = context.dataset.label ? `${context.dataset.label}: ` : "";
              const value = context.parsed.y;
              return `${label}${formatNumber(value, Math.abs(value) >= 100 ? 0 : 2)}`;
            },
          },
        },
        zoom: {
          pan: { enabled: true, mode: "x", modifierKey: "shift" },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" },
          limits: { x: { minRange: 3 } },
        },
      },
      scales,
    };
  }

  function createChart(canvasId, config) {
    if (!window.Chart) return null;
    const canvas = qs(`#${canvasId}`);
    if (!canvas) return null;
    const existing = state.charts.get(canvasId);
    if (existing) existing.destroy();
    const chart = new window.Chart(canvas.getContext("2d"), config);
    state.charts.set(canvasId, chart);
    return chart;
  }

  function resetChart(canvasId) {
    const chart = state.charts.get(canvasId);
    if (!chart) return;
    if (typeof chart.resetZoom === "function") chart.resetZoom();
    else chart.reset();
  }

  function makeDataset(label, data, color, options = {}) {
    return {
      label,
      data,
      borderColor: color,
      backgroundColor: options.fillColor || `${color}22`,
      pointBackgroundColor: color,
      pointRadius: options.pointRadius ?? 2,
      pointHoverRadius: 4,
      borderWidth: options.borderWidth ?? 2,
      tension: options.tension ?? 0.22,
      fill: Boolean(options.fill),
      hidden: Boolean(options.hidden),
      yAxisID: options.yAxisID || "y",
      type: options.type,
    };
  }

  function renderTags(container, values) {
    clearElement(container);
    const items = normalizeList(values);
    items.forEach((item) => container.appendChild(createElement("span", "tag", humanize(item))));
    return items.length;
  }

  function renderActionList(container, values) {
    clearElement(container);
    const items = normalizeList(values);
    items.forEach((item) => container.appendChild(createElement("li", "", item)));
    return items.length;
  }

  function createTableCell(value, className = "") {
    return createElement("td", className, value ?? "—");
  }

  function setButtonBusy(button, busy, busyText = "Working…") {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent.trim();
      button.disabled = true;
      clearElement(button);
      button.appendChild(createIcon("loader-circle", "spin-icon"));
      button.appendChild(document.createTextNode(busyText));
      refreshIcons(button);
    } else {
      button.disabled = false;
      const text = button.dataset.originalText;
      if (text) {
        button.textContent = text;
        delete button.dataset.originalText;
      }
      refreshIcons(button);
    }
  }

  function beginForecastProgress(label = "Preparing the forecast workflow…") {
    const progress = state.forecastProgress;
    progress.depth += 1;
    progress.failed = false;
    if (progress.hideTimer) window.clearTimeout(progress.hideTimer);
    const shell = qs("#forecast-progress-shell");
    if (!shell) return;
    shell.hidden = false;
    shell.classList.remove("complete", "failed");
    setText("#forecast-progress-title", "Running forecast");
    setText("#forecast-progress-label", label, "");
    refreshIcons(shell);
    window.requestAnimationFrame(() => shell.classList.add("visible"));
  }

  function updateForecastProgress(label) {
    if (!state.forecastProgress.depth) return;
    setText("#forecast-progress-label", label, "");
  }

  function endForecastProgress(success = true, label = "Forecast completed.") {
    const progress = state.forecastProgress;
    if (!success) progress.failed = true;
    progress.depth = Math.max(0, progress.depth - 1);
    if (progress.depth > 0) return;
    const shell = qs("#forecast-progress-shell");
    if (!shell) return;
    const finalSuccess = !progress.failed;
    shell.classList.remove("complete", "failed");
    shell.classList.add(finalSuccess ? "complete" : "failed");
    setText("#forecast-progress-title", finalSuccess ? "Forecast ready" : "Forecast stopped");
    setText("#forecast-progress-label", finalSuccess ? label : "Review the forecast message and try again.", "");
    progress.hideTimer = window.setTimeout(() => {
      shell.classList.remove("visible", "complete", "failed");
      window.setTimeout(() => { shell.hidden = true; }, 220);
      progress.failed = false;
    }, finalSuccess ? 850 : 1500);
  }

  const NAV_GROUP_PAGES = {
    forecast: new Set(["forecast", "long-term-forecast", "forecast-history"]),
    system: new Set(["system-information", "model-performance", "data-management"]),
  };

  function setNavGroupOpen(groupName, open) {
    const group = qs(`[data-nav-group="${groupName}"]`);
    const toggle = qs(`[data-nav-group-toggle="${groupName}"]`);
    const submenu = group?.querySelector(".nav-submenu");
    if (!group || !toggle || !submenu) return;
    if (submenu._wattzanTimer) window.clearTimeout(submenu._wattzanTimer);
    toggle.setAttribute("aria-expanded", String(open));

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (open) {
      submenu.hidden = false;
      submenu.style.maxHeight = "0px";
      submenu.style.opacity = "0";
      submenu.style.transform = "translateY(-6px)";
      group.classList.add("open");
      window.requestAnimationFrame(() => {
        submenu.style.maxHeight = `${submenu.scrollHeight}px`;
        submenu.style.opacity = "1";
        submenu.style.transform = "translateY(0)";
      });
      submenu._wattzanTimer = window.setTimeout(() => {
        if (group.classList.contains("open")) submenu.style.maxHeight = `${submenu.scrollHeight}px`;
      }, reducedMotion ? 0 : 300);
      return;
    }

    if (submenu.hidden) {
      group.classList.remove("open");
      return;
    }
    submenu.style.maxHeight = `${submenu.scrollHeight}px`;
    submenu.style.opacity = "1";
    submenu.style.transform = "translateY(0)";
    window.requestAnimationFrame(() => {
      group.classList.remove("open");
      submenu.style.maxHeight = "0px";
      submenu.style.opacity = "0";
      submenu.style.transform = "translateY(-6px)";
    });
    submenu._wattzanTimer = window.setTimeout(() => {
      if (!group.classList.contains("open")) {
        submenu.hidden = true;
        submenu.style.maxHeight = "";
        submenu.style.opacity = "";
        submenu.style.transform = "";
      }
    }, reducedMotion ? 0 : 280);
  }

  function updateNavigationState(page) {
    qsa(".nav-item[data-page-target], .nav-subitem[data-page-target]").forEach((item) => {
      const active = item.dataset.pageTarget === page;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });

    Object.entries(NAV_GROUP_PAGES).forEach(([groupName, pages]) => {
      const group = qs(`[data-nav-group="${groupName}"]`);
      const toggle = qs(`[data-nav-group-toggle="${groupName}"]`);
      const active = pages.has(page);
      group?.classList.toggle("active-group", active);
      toggle?.classList.toggle("active", active);
      if (active) setNavGroupOpen(groupName, true);
    });
  }

  function setupNavigation() {
    qsa("[data-page-target]").forEach((button) => {
      button.addEventListener("click", () => navigateTo(button.dataset.pageTarget));
    });
    qsa("[data-nav-group-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const groupName = button.dataset.navGroupToggle;
        const willOpen = button.getAttribute("aria-expanded") !== "true";
        setNavGroupOpen(groupName, willOpen);
      });
    });
    qs("#mobile-menu-button").addEventListener("click", () => toggleSidebar());
    qs("#sidebar-backdrop").addEventListener("click", () => toggleSidebar(false));
    updateNavigationState(state.currentPage);
  }

  function toggleSidebar(force) {
    const sidebar = qs("#sidebar");
    const button = qs("#mobile-menu-button");
    const backdrop = qs("#sidebar-backdrop");
    const open = force === undefined ? !sidebar.classList.contains("open") : force;
    sidebar.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
    backdrop.hidden = !open;
  }

  async function navigateTo(page) {
    if (!PAGE_TITLES[page]) return;
    state.currentPage = page;
    qsa(".page-section").forEach((section) => {
      const active = section.dataset.page === page;
      section.hidden = !active;
      section.classList.toggle("active", active);
    });
    updateNavigationState(page);
    setText("#page-title", PAGE_TITLES[page]);
    toggleSidebar(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    await refreshPage(page, false);
    if (page === "long-term-forecast" && state.longTerm.map) {
      window.setTimeout(() => state.longTerm.map.invalidateSize(), 80);
    }
    if (page === "forecast" && state.shortTerm.map) {
      window.setTimeout(() => state.shortTerm.map.invalidateSize(), 80);
    }
    if (page === "overview" && state.overviewMap.renderer) {
      window.setTimeout(() => {
        resizeOverview3DRenderer();
        startOverview3DAutoRotate();
      }, 80);
    } else {
      stopOverview3DAutoRotate();
    }
  }

  async function loadCoreData() {
    const calls = {
      health: apiFetch("/health"),
      modelStatus: apiFetch("/models/status"),
      performance: apiFetch("/models/performance"),
      activeDataset: apiFetch("/data/active"),
      municipalityProfiles: apiFetch("/data/municipalities"),
      dataSummary: apiFetch("/data/summary"),
      history: apiFetch("/forecast/history?limit=1000"),
      overviewMapGeometry: loadOverviewMapGeometry(),
    };
    const entries = Object.entries(calls);
    const settled = await Promise.allSettled(entries.map(([, promise]) => promise));
    let successCount = 0;
    settled.forEach((result, index) => {
      const key = entries[index][0];
      if (result.status === "fulfilled") {
        if (key !== "overviewMapGeometry") successCount += 1;
        if (key === "history") state.history = result.value.forecasts || [];
        else if (key === "municipalityProfiles") state.municipalityProfiles = result.value.municipalities || [];
        else if (key === "overviewMapGeometry") state.overviewMap.geometry = result.value;
        else state[key] = result.value;
      }
    });
    if (successCount === 0) {
      const firstFailure = settled.find((result) => result.status === "rejected");
      setApiConnection(false, errorMessage(firstFailure?.reason));
      throw firstFailure?.reason || new Error("Backend unavailable");
    }
    setApiConnection(Boolean(state.health), state.health ? "" : "Some API endpoints are unavailable.");
    updateSharedStatus();
    renderAllFromState();
  }

  function updateSharedStatus() {
    if (state.health) {
      setText("#sidebar-version", `Version ${state.health.version || "—"}`);
      setText("#sidebar-version", `Version ${state.health.version || "—"}`);
    }
    setModelStatus(state.modelStatus);
    setText("#sidebar-version", state.health?.version ? `Version ${state.health.version}` : "Version —");
  }

  function renderAllFromState() {
    renderOverview();
    renderDataManagement();
    renderPerformance();
    renderRecommendations();
    renderHistory();
    renderSystemInformation();
    renderAssistantMessages();
    populateForecastMunicipalitySelects();
    prefillForecastDates();
    prefillLongTermForm();
  }

  async function refreshPage(page, showSuccess = true) {
    try {
      if (page === "overview") {
        await Promise.all([refreshHistory(), refreshSummary(), refreshPerformance(), refreshModelStatus(), refreshActiveDataset()]);
        renderOverview();
      } else if (page === "forecast") {
        await Promise.all([refreshActiveDataset(), refreshModelStatus()]);
        prefillForecastDates();
      } else if (page === "long-term-forecast") {
        await Promise.all([refreshSummary(), refreshActiveDataset()]);
        prefillLongTermForm();
        if (state.longTerm.projection) renderLongTermProjection(state.longTerm.projection);
      } else if (page === "data-management") {
        await Promise.all([refreshActiveDataset(), refreshSummary()]);
        renderDataManagement();
      } else if (page === "model-performance") {
        await refreshPerformance();
        renderPerformance();
      } else if (page === "recommendations") {
        await refreshHistory();
        renderRecommendations();
      } else if (page === "forecast-history") {
        await refreshHistory(getHistoryQuery());
        renderHistory();
      } else if (page === "system-information") {
        await Promise.all([refreshHealth(), refreshModelStatus()]);
        renderSystemInformation();
      }
      updateSharedStatus();
      if (showSuccess) showToast("Refreshed", `${PAGE_TITLES[page]} data was refreshed.`, "success");
    } catch (error) {
      showToast("Refresh failed", errorMessage(error), "error");
    }
  }

  async function refreshHealth() { state.health = await apiFetch("/health"); return state.health; }
  async function refreshModelStatus() { state.modelStatus = await apiFetch("/models/status"); return state.modelStatus; }
  async function refreshPerformance() { state.performance = await apiFetch("/models/performance"); return state.performance; }
  async function refreshActiveDataset() { state.activeDataset = await apiFetch("/data/active"); return state.activeDataset; }
  async function refreshSummary() { state.dataSummary = await apiFetch("/data/summary"); return state.dataSummary; }
  async function refreshHistory(query = "limit=1000") {
    const payload = await apiFetch(`/forecast/history?${query}`);
    state.history = payload.forecasts || [];
    state.filteredHistory = [...state.history];
    return state.history;
  }

  function sortHistory(records, sortMode = "created_desc") {
    const sorted = [...records];
    const numericOrNegativeInfinity = (value) => Number.isFinite(Number(value)) ? Number(value) : -Infinity;
    sorted.sort((a, b) => {
      if (sortMode === "date_asc") return String(a.forecast_date).localeCompare(String(b.forecast_date));
      if (sortMode === "date_desc") return String(b.forecast_date).localeCompare(String(a.forecast_date));
      if (sortMode === "prediction_desc") return numericOrNegativeInfinity(b.selected_prediction_kwh) - numericOrNegativeInfinity(a.selected_prediction_kwh);
      if (sortMode === "utilization_desc") return numericOrNegativeInfinity(b.capacity_utilization_pct) - numericOrNegativeInfinity(a.capacity_utilization_pct);
      return String(b.created_at).localeCompare(String(a.created_at));
    });
    return sorted;
  }

  function getLatestForecast(records = state.history) {
    return sortHistory(records, "created_desc")[0] || null;
  }

  function findHybridMetric() {
    return state.performance?.model_metrics?.find((metric) => String(metric.model).toLowerCase().includes("hybrid")) || null;
  }

  function svgElement(tag, attributes = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }

  function overviewMapYears() {
    const byMunicipality = state.dataSummary?.annual_consumption_by_municipality_kwh || {};
    const years = new Set();
    Object.values(byMunicipality).forEach((values) => Object.keys(values || {}).forEach((year) => years.add(String(year))));
    return [...years].sort((a, b) => Number(a) - Number(b));
  }

  function populateOverviewMapYears() {
    const select = qs("#overview-map-year");
    if (!select) return [];
    const years = overviewMapYears();
    const current = state.overviewMap.year || select.value;
    clearElement(select);
    years.forEach((year) => select.appendChild(new Option(year, year)));
    const preferred = years.includes(String(current)) ? String(current) : years.at(-1) || "";
    select.value = preferred;
    state.overviewMap.year = preferred || null;
    return years;
  }

  function municipalityAnnualValues(year) {
    const source = state.dataSummary?.annual_consumption_by_municipality_kwh || {};
    const values = {};
    MUNICIPALITIES.forEach((item) => {
      const numeric = Number(source[item.name]?.[String(year)]);
      if (Number.isFinite(numeric)) values[item.name] = numeric;
    });
    return values;
  }

  function hexToRgb(hex) {
    const normalized = hex.replace("#", "");
    const expanded = normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized;
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
    };
  }

  function interpolateColor(start, end, amount) {
    const a = hexToRgb(start);
    const b = hexToRgb(end);
    const channel = (key) => Math.round(a[key] + (b[key] - a[key]) * amount).toString(16).padStart(2, "0");
    return `#${channel("r")}${channel("g")}${channel("b")}`;
  }

  function overviewMapColor(value, minimum, maximum) {
    if (!Number.isFinite(value)) return "#edf1f5";
    if (maximum <= minimum) return OVERVIEW_MAP_COLORS[3];

    // Compress the near-white portion of the scale so only the minimum values
    // remain white. Most municipalities occupy vivid blue tones, while the
    // highest-consumption areas transition into a restrained blue-violet indigo.
    const raw = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
    const normalized = Math.pow(raw, 0.38);
    const scaled = normalized * (OVERVIEW_MAP_COLORS.length - 1);
    const lower = Math.floor(scaled);
    const upper = Math.min(OVERVIEW_MAP_COLORS.length - 1, lower + 1);
    return interpolateColor(OVERVIEW_MAP_COLORS[lower], OVERVIEW_MAP_COLORS[upper], scaled - lower);
  }

  function featureRings(feature) {
    const geometry = feature?.geometry;
    if (!geometry) return [];
    if (geometry.type === "Polygon") return geometry.coordinates;
    if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
    return [];
  }

  function overviewMapProjection(features) {
    const points = features.flatMap((feature) => featureRings(feature).flat());
    const longitudes = points.map((point) => Number(point[0])).filter(Number.isFinite);
    const latitudes = points.map((point) => Number(point[1])).filter(Number.isFinite);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const compact = window.matchMedia("(max-width: 900px)").matches;
    const bounds = compact
      ? { left: 36, right: 884, top: 32, bottom: 560 }
      : { left: 35, right: 660, top: 30, bottom: 605 };
    const scale = Math.min(
      (bounds.right - bounds.left) / (maxLongitude - minLongitude),
      (bounds.bottom - bounds.top) / (maxLatitude - minLatitude),
    );
    const projectedWidth = (maxLongitude - minLongitude) * scale;
    const projectedHeight = (maxLatitude - minLatitude) * scale;
    const offsetX = bounds.left + ((bounds.right - bounds.left) - projectedWidth) / 2;
    const offsetY = bounds.top + ((bounds.bottom - bounds.top) - projectedHeight) / 2;
    return ([longitude, latitude]) => [
      offsetX + (Number(longitude) - minLongitude) * scale,
      offsetY + (maxLatitude - Number(latitude)) * scale,
    ];
  }

  function featurePath(feature, project) {
    return featureRings(feature).map((ring) => ring.map((point, index) => {
      const [x, y] = project(point);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ") + " Z").join(" ");
  }

  function mapLabelLines(name) {
    const labels = {
      "President Quirino": ["President", "Quirino"],
      "Senator Ninoy Aquino": ["Sen. Ninoy", "Aquino"],
      "Tacurong City": ["Tacurong", "City"],
    };
    return labels[name] || [name];
  }

  function featureLabelPoint(feature, project) {
    const points = featureRings(feature).flat();
    const projected = points.map(project);
    const count = Math.max(1, projected.length);
    const center = projected.reduce((total, [x, y]) => ({ x: total.x + x, y: total.y + y }), { x: 0, y: 0 });
    const offsets = {
      "Tacurong City": [-8, 11],
      "President Quirino": [17, -8],
      Isulan: [0, 4],
      "Senator Ninoy Aquino": [0, 5],
    };
    const [offsetX, offsetY] = offsets[feature.properties.municipality] || [0, 0];
    return [(center.x / count) + offsetX, (center.y / count) + offsetY];
  }

  function municipalityProfile(name) {
    return state.municipalityProfiles.find((profile) => profile.municipality === name)
      || MUNICIPALITIES.find((item) => item.name === name)
      || null;
  }

  function municipalityHybridMetric(name) {
    return state.performance?.municipality_metrics?.find((metric) => (
      metric.municipality === name && String(metric.model).toLowerCase().includes("hybrid")
    )) || null;
  }

  function municipalityMapRank(values, name) {
    const ranked = Object.entries(values).sort(([, a], [, b]) => Number(b) - Number(a));
    const index = ranked.findIndex(([municipality]) => municipality === name);
    return index >= 0 ? `${index + 1} of ${ranked.length}` : "—";
  }

  function hideOverviewMapTooltip() {
    setHidden("#overview-map-tooltip", true);
  }

  function showOverviewMapTooltip(event, name, value, year) {
    const tooltip = qs("#overview-map-tooltip");
    const stage = qs("#overview-map-stage");
    if (!tooltip || !stage) return;
    clearElement(tooltip);
    tooltip.append(
      createElement("strong", "", name),
      createElement("span", "", `${formatNumber(value / 1_000_000, 2)} GWh in ${year}`),
    );
    const stageRect = stage.getBoundingClientRect();
    tooltip.style.left = `${Math.max(6, Math.min(stageRect.width - 220, event.clientX - stageRect.left))}px`;
    tooltip.style.top = `${Math.max(6, Math.min(stageRect.height - 70, event.clientY - stageRect.top))}px`;
    setHidden(tooltip, false);
  }

  function closeOverviewMapPopup({ rerender = true } = {}) {
    state.overviewMap.selectedMunicipality = null;
    setHidden("#overview-map-popup", true);
    hideOverviewMapTooltip();
    if (rerender) updateOverview3DSelectionStyles();
  }

  function renderOverviewMapPopup(name, year, values) {
    const popup = qs("#overview-map-popup");
    const profile = municipalityProfile(name);
    const metric = municipalityHybridMetric(name);
    const consumption = Number(values[name]);
    const total = Object.values(values).reduce((sum, value) => sum + Number(value || 0), 0);
    const days = Number(year) % 4 === 0 ? 366 : 365;
    setText("#overview-map-popup-title", name);
    setText("#overview-map-popup-type", profile?.municipality_type || profile?.type || "Municipality");
    setText("#overview-map-popup-consumption", formatNumber(consumption / 1_000_000, 2));
    setText("#overview-map-popup-year", year);
    setText("#overview-map-popup-share", total > 0 ? formatPercent((consumption / total) * 100, 2) : null);
    setText("#overview-map-popup-daily", `${formatNumber(consumption / days, 0)} kWh`);
    setText("#overview-map-popup-population", formatNumber(profile?.population, 0));
    setText("#overview-map-popup-customers", formatNumber(profile?.customer_count, 0));
    setText("#overview-map-popup-supply", humanize(profile?.supply_system));
    setText("#overview-map-popup-mape", metric ? formatPercent(metric.mape_pct, 2) : null);
    setText("#overview-map-popup-rank", municipalityMapRank(values, name));
    setHidden(popup, false);
    refreshIcons(popup);
  }

  function selectOverviewMapMunicipality(name) {
    const year = state.overviewMap.year || overviewMapYears().at(-1);
    const values = municipalityAnnualValues(year);
    if (!Number.isFinite(Number(values[name]))) return;
    state.overviewMap.selectedMunicipality = name;
    updateOverview3DSelectionStyles();
    renderOverviewMapPopup(name, year, values);
  }

  function overview3DProjectedRings(feature, projection) {
    return featureRings(feature)
      .map((ring) => ring.map((point) => projection(point)))
      .filter((ring) => ring.length >= 3);
  }

  function overview3DProjection(features) {
    const points = features.flatMap((feature) => featureRings(feature).flat());
    const longitudes = points.map((point) => Number(point[0])).filter(Number.isFinite);
    const latitudes = points.map((point) => Number(point[1])).filter(Number.isFinite);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const centerLongitude = (minLongitude + maxLongitude) / 2;
    const centerLatitude = (minLatitude + maxLatitude) / 2;
    const scale = 105 / Math.max(maxLongitude - minLongitude, maxLatitude - minLatitude);
    return ([longitude, latitude]) => [
      (Number(longitude) - centerLongitude) * scale,
      (Number(latitude) - centerLatitude) * scale,
    ];
  }

  function requestOverview3DRender() {
    const mapState = state.overviewMap;
    if (!mapState.renderer || !mapState.scene || !mapState.camera || mapState.renderQueued) return;
    mapState.renderQueued = true;
    mapState.animationFrame = window.requestAnimationFrame(() => {
      mapState.renderQueued = false;
      if (state.currentPage !== "overview" || document.hidden) return;
      mapState.renderer.render(mapState.scene, mapState.camera);
    });
  }

  function stopOverview3DAutoRotate() {
    const frame = state.overviewMap.autoRotateFrame;
    if (frame) window.cancelAnimationFrame(frame);
    state.overviewMap.autoRotateFrame = null;
  }

  function startOverview3DAutoRotate() {
    if (state.overviewMap.autoRotateFrame || state.currentPage !== "overview" || document.hidden) return;
    const tick = () => {
      state.overviewMap.autoRotateFrame = null;
      if (state.currentPage !== "overview" || document.hidden) return;
      const controls = state.overviewMap.controls;
      const renderer = state.overviewMap.renderer;
      const scene = state.overviewMap.scene;
      const camera = state.overviewMap.camera;
      if (!controls || !renderer || !scene || !camera) return;
      controls.update();
      renderer.render(scene, camera);
      state.overviewMap.autoRotateFrame = window.requestAnimationFrame(tick);
    };
    state.overviewMap.autoRotateFrame = window.requestAnimationFrame(tick);
  }

  function resizeOverview3DRenderer() {
    const container = qs("#overview-consumption-map");
    const renderer = state.overviewMap.renderer;
    const camera = state.overviewMap.camera;
    if (!container || !renderer || !camera) return;
    const width = Math.max(320, container.clientWidth);
    const height = Math.max(320, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestOverview3DRender();
  }

  function resetOverview3DCamera() {
    const camera = state.overviewMap.camera;
    const controls = state.overviewMap.controls;
    if (!camera || !controls) return;
    camera.position.set(0, 60, 112);
    controls.target.set(0, 2.4, 0);
    controls.update();
    requestOverview3DRender();
  }

  function updateOverview3DSelectionStyles() {
    const selected = state.overviewMap.selectedMunicipality;
    state.overviewMap.meshes.forEach((mesh) => {
      const isSelected = mesh.userData.municipality === selected;
      mesh.material.opacity = selected && !isSelected ? 0.34 : 1;
      mesh.material.transparent = Boolean(selected && !isSelected);
      if (mesh.material.emissive) {
        mesh.material.emissive.set(isSelected ? "#123d69" : "#000000");
        mesh.material.emissiveIntensity = isSelected ? 0.22 : 0;
      }
    });
    requestOverview3DRender();
  }

  function ensureOverview3DScene() {
    const container = qs("#overview-consumption-map");
    if (!container || !window.THREE || !window.THREE.OrbitControls) return false;
    if (state.overviewMap.renderer) return true;

    const scene = new window.THREE.Scene();
    scene.background = new window.THREE.Color("#e8eff5");

    const camera = new window.THREE.PerspectiveCamera(38, 1, 0.1, 500);
    const renderer = new window.THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.shadowMap.enabled = false;
    renderer.domElement.className = "overview-3d-canvas";
    renderer.domElement.setAttribute("aria-label", "Three-dimensional Sultan Kudarat electricity consumption map");
    container.appendChild(renderer.domElement);

    const controls = new window.THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 58;
    controls.maxDistance = 225;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI / 2.04;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.16;

    scene.add(new window.THREE.HemisphereLight(0xffffff, 0x7894ad, 1.42));
    const keyLight = new window.THREE.DirectionalLight(0xffffff, 0.92);
    keyLight.position.set(-55, 90, 45);
    keyLight.castShadow = false;
    scene.add(keyLight);
    const fillLight = new window.THREE.DirectionalLight(0x9cc7ea, 0.42);
    fillLight.position.set(55, 45, -35);
    scene.add(fillLight);

    const ground = new window.THREE.Mesh(
      new window.THREE.PlaneGeometry(165, 145),
      new window.THREE.MeshStandardMaterial({ color: 0xdce6ee, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.65;
    ground.receiveShadow = false;
    scene.add(ground);

    const majorGrid = new window.THREE.GridHelper(160, 20, 0x6f93b2, 0x9db4c8);
    majorGrid.position.y = -0.56;
    majorGrid.material.transparent = true;
    majorGrid.material.opacity = 0.42;
    scene.add(majorGrid);

    const minorGrid = new window.THREE.GridHelper(160, 80, 0xb4c5d4, 0xc8d5e0);
    minorGrid.position.y = -0.55;
    minorGrid.material.transparent = true;
    minorGrid.material.opacity = 0.2;
    scene.add(minorGrid);

    state.overviewMap.scene = scene;
    state.overviewMap.camera = camera;
    state.overviewMap.renderer = renderer;
    state.overviewMap.controls = controls;
    state.overviewMap.raycaster = new window.THREE.Raycaster();
    state.overviewMap.pointer = new window.THREE.Vector2();
    resetOverview3DCamera();
    resizeOverview3DRenderer();

    const setPointer = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      state.overviewMap.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      state.overviewMap.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      state.overviewMap.raycaster.setFromCamera(state.overviewMap.pointer, camera);
      return state.overviewMap.raycaster.intersectObjects(state.overviewMap.meshes, false)[0] || null;
    };

    renderer.domElement.addEventListener("pointermove", (event) => {
      const hit = setPointer(event);
      renderer.domElement.style.cursor = hit ? "pointer" : "grab";
      if (!hit) {
        state.overviewMap.hoverMunicipality = null;
        hideOverviewMapTooltip();
        return;
      }
      const name = hit.object.userData.municipality;
      const year = state.overviewMap.year || overviewMapYears().at(-1);
      const values = municipalityAnnualValues(year);
      state.overviewMap.hoverMunicipality = name;
      showOverviewMapTooltip(event, name, Number(values[name]), year);
    });
    renderer.domElement.addEventListener("pointerleave", () => {
      state.overviewMap.hoverMunicipality = null;
      hideOverviewMapTooltip();
    });
    renderer.domElement.addEventListener("click", (event) => {
      const hit = setPointer(event);
      if (hit?.object?.userData?.municipality) selectOverviewMapMunicipality(hit.object.userData.municipality);
    });

    controls.addEventListener("change", requestOverview3DRender);
    renderer.domElement.addEventListener("webglcontextrestored", requestOverview3DRender);
    requestOverview3DRender();
    startOverview3DAutoRotate();

    if (window.ResizeObserver) {
      state.overviewMap.resizeObserver = new ResizeObserver(resizeOverview3DRenderer);
      state.overviewMap.resizeObserver.observe(container);
    }
    return true;
  }

  function overviewRingArea(ring) {
    return Math.abs(ring.reduce((sum, point, index) => {
      const next = ring[(index + 1) % ring.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2);
  }

  function createOverviewTextSprite(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 448;
    canvas.height = 84;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(255,255,255,0.94)";
    context.strokeStyle = "rgba(23,105,170,0.88)";
    context.lineWidth = 4;
    context.beginPath();
    if (typeof context.roundRect === "function") context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 15);
    else context.rect(8, 8, canvas.width - 16, canvas.height - 16);
    context.fill();
    context.stroke();
    context.fillStyle = "#0b2e4f";
    context.font = "700 25px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(text), canvas.width / 2, canvas.height / 2 + 1, canvas.width - 34);
    const texture = new window.THREE.CanvasTexture(canvas);
    texture.minFilter = window.THREE.LinearFilter;
    const material = new window.THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new window.THREE.Sprite(material);
    sprite.scale.set(17.5, 3.3, 1);
    sprite.renderOrder = 20;
    sprite.userData.texture = texture;
    return sprite;
  }

  function createOverviewMunicipalityMarker(name, x, z, topY) {
    const group = new window.THREE.Group();
    group.position.set(x, topY + 0.5, z);

    const pinMaterial = new window.THREE.MeshStandardMaterial({
      color: 0x2384d4,
      emissive: 0x0b2e4f,
      emissiveIntensity: 0.12,
      roughness: 0.45,
      metalness: 0.08,
    });
    const point = new window.THREE.Mesh(new window.THREE.ConeGeometry(0.72, 2.25, 16), pinMaterial);
    point.rotation.x = Math.PI;
    point.position.y = 1.05;
    const head = new window.THREE.Mesh(new window.THREE.SphereGeometry(0.92, 18, 14), pinMaterial);
    head.position.y = 2.25;
    const center = new window.THREE.Mesh(
      new window.THREE.SphereGeometry(0.32, 14, 10),
      new window.THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    center.position.set(0, 2.25, 0.72);
    const label = createOverviewTextSprite(name);
    label.position.y = 5.25;
    group.add(point, head, center, label);
    group.userData.municipality = name;
    group.userData.label = label;
    return group;
  }

  function disposeOverviewDecoration(object) {
    object.traverse?.((child) => {
      child.geometry?.dispose?.();
      if (child.material) {
        child.material.map?.dispose?.();
        child.userData?.texture?.dispose?.();
        child.material.dispose?.();
      }
    });
  }

  function clearOverview3DMeshes() {
    const scene = state.overviewMap.scene;
    if (!scene) return;
    state.overviewMap.meshes.forEach((mesh) => {
      scene.remove(mesh);
      mesh.geometry?.dispose?.();
      mesh.material?.dispose?.();
      const outline = mesh.userData.outline;
      if (outline) {
        scene.remove(outline);
        outline.geometry?.dispose?.();
        outline.material?.dispose?.();
      }
    });
    state.overviewMap.meshes = [];
    state.overviewMap.decorations.forEach((object) => {
      scene.remove(object);
      disposeOverviewDecoration(object);
    });
    state.overviewMap.decorations = [];
  }

  function renderOverviewConsumptionMap() {
    const container = qs("#overview-consumption-map");
    const geometry = state.overviewMap.geometry?.features || [];
    const years = populateOverviewMapYears();
    const year = state.overviewMap.year || years.at(-1);
    const values = municipalityAnnualValues(year);
    const numericValues = Object.values(values).map(Number).filter(Number.isFinite);
    const hasData = geometry.length > 0 && numericValues.length > 0;
    setHidden("#overview-map-empty", hasData);
    if (!container || !hasData) return;
    if (!ensureOverview3DScene()) {
      setText("#overview-map-empty", "The 3D map library or WebGL could not be loaded. Check the internet connection and browser graphics support.");
      setHidden("#overview-map-empty", false);
      return;
    }

    const minimum = Math.min(...numericValues);
    const maximum = Math.max(...numericValues);
    const project = overview3DProjection(geometry);
    clearOverview3DMeshes();

    geometry.forEach((feature) => {
      const name = feature.properties.municipality;
      const value = Number(values[name]);
      const normalized = maximum <= minimum ? 0.5 : Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
      const height = 1.25 + Math.sqrt(normalized) * 7.25;
      const color = overviewMapColor(value, minimum, maximum);

      const projectedRings = overview3DProjectedRings(feature, project);
      projectedRings.forEach((ring) => {
        const centroid = ring.reduce((sum, [x, y]) => ({ x: sum.x + x, y: sum.y + y }), { x: 0, y: 0 });
        centroid.x /= ring.length;
        centroid.y /= ring.length;
        const shape = new window.THREE.Shape();
        ring.forEach(([x, y], index) => {
          const localX = (x - centroid.x) * OVERVIEW_3D_GAP_SCALE;
          const localY = (y - centroid.y) * OVERVIEW_3D_GAP_SCALE;
          if (index === 0) shape.moveTo(localX, localY);
          else shape.lineTo(localX, localY);
        });
        shape.closePath();

        const meshGeometry = new window.THREE.ExtrudeGeometry(shape, {
          depth: height,
          bevelEnabled: true,
          bevelSegments: 1,
          bevelSize: 0.12,
          bevelThickness: 0.12,
          curveSegments: 1,
        });
        meshGeometry.rotateX(-Math.PI / 2);
        const material = new window.THREE.MeshStandardMaterial({
          color,
          roughness: 0.66,
          metalness: 0.03,
          transparent: false,
          opacity: 1,
        });
        const mesh = new window.THREE.Mesh(meshGeometry, material);
        mesh.position.set(centroid.x, 0, -centroid.y);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.userData.municipality = name;
        mesh.userData.value = value;
        mesh.userData.height = height;

        const outline = new window.THREE.LineSegments(
          new window.THREE.EdgesGeometry(meshGeometry, 24),
          new window.THREE.LineBasicMaterial({ color: 0x6f8faa, transparent: true, opacity: 0.86 }),
        );
        outline.position.copy(mesh.position);
        outline.renderOrder = 2;
        mesh.userData.outline = outline;
        state.overviewMap.scene.add(mesh, outline);
        state.overviewMap.meshes.push(mesh);
      });

      const markerRing = [...projectedRings].sort((a, b) => overviewRingArea(b) - overviewRingArea(a))[0];
      if (markerRing?.length) {
        const markerCentroid = markerRing.reduce((sum, [x, y]) => ({ x: sum.x + x, y: sum.y + y }), { x: 0, y: 0 });
        markerCentroid.x /= markerRing.length;
        markerCentroid.y /= markerRing.length;
        const marker = createOverviewMunicipalityMarker(name, markerCentroid.x, -markerCentroid.y, height);
        state.overviewMap.scene.add(marker);
        state.overviewMap.decorations.push(marker);
      }
    });

    updateOverview3DSelectionStyles();
    setText("#overview-map-legend-min", `${formatNumber(minimum / 1_000_000, 1)} GWh`);
    setText("#overview-map-legend-max", `${formatNumber(maximum / 1_000_000, 1)} GWh`);
    const selected = state.overviewMap.selectedMunicipality;
    if (selected && Number.isFinite(Number(values[selected]))) renderOverviewMapPopup(selected, year, values);
    else setHidden("#overview-map-popup", true);
    resizeOverview3DRenderer();
    requestOverview3DRender();
  }

  function clampNumber(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value)));
  }

  function forecastRecordMunicipality(record) {
    return record?.municipality
      || record?.input_data?.municipality
      || record?.input_data?.location?.municipality
      || null;
  }

  function calculateOperationalStability() {
    const latest = getLatestForecast();
    if (!latest) return { score: null, label: "Awaiting forecast", color: COLORS.gray, note: "Run a forecast to calculate stability." };

    const municipality = forecastRecordMunicipality(latest);
    let recent = sortHistory(state.history, "date_asc")
      .filter((record) => !municipality || forecastRecordMunicipality(record) === municipality)
      .slice(-7);
    if (!recent.length) recent = [latest];

    const levelScores = { NORMAL: 100, ELEVATED: 76, HIGH: 48, CRITICAL: 18 };
    const demandScores = recent.map((record) => levelScores[String(record.demand_level || "").toUpperCase()]).filter(Number.isFinite);
    const demandComponent = demandScores.length
      ? demandScores.reduce((sum, value) => sum + value, 0) / demandScores.length
      : 70;

    const utilizations = recent.map((record) => Number(record.capacity_utilization_pct)).filter(Number.isFinite);
    let capacityComponent = null;
    if (utilizations.length) {
      capacityComponent = utilizations.reduce((sum, utilization) => {
        let score;
        if (utilization <= 70) score = 100;
        else if (utilization <= 85) score = 100 - (utilization - 70) * 1.35;
        else if (utilization <= 100) score = 79.75 - (utilization - 85) * 2.65;
        else score = 40 - (utilization - 100) * 2;
        return sum + clampNumber(score, 0, 100);
      }, 0) / utilizations.length;
    }

    const predictions = recent
      .map((record) => Number(record.selected_prediction_kwh ?? record.hybrid_prediction_kwh))
      .filter((value) => Number.isFinite(value) && value > 0);
    let variabilityComponent = 82;
    if (predictions.length >= 2) {
      const mean = predictions.reduce((sum, value) => sum + value, 0) / predictions.length;
      const variance = predictions.reduce((sum, value) => sum + (value - mean) ** 2, 0) / predictions.length;
      const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 0;
      variabilityComponent = clampNumber(100 - coefficientOfVariation * 520, 25, 100);
    }

    const weighted = capacityComponent === null
      ? demandComponent * 0.62 + variabilityComponent * 0.38
      : demandComponent * 0.46 + capacityComponent * 0.31 + variabilityComponent * 0.23;
    const score = Math.round(clampNumber(weighted, 0, 100));
    let label = "Critical instability";
    let color = COLORS.critical;
    if (score >= 82) { label = "Stable"; color = COLORS.success; }
    else if (score >= 66) { label = "Generally stable"; color = COLORS.blue; }
    else if (score >= 48) { label = "Watch conditions"; color = COLORS.elevated; }
    else if (score >= 30) { label = "High strain"; color = COLORS.high; }

    const note = capacityComponent === null
      ? "Based on demand level and recent forecast variation; capacity was not provided."
      : "Based on demand level, capacity margin, and recent forecast variation.";
    return { score, label, color, note };
  }

  function renderStabilityIndicator(donutSelector, scoreSelector, labelSelector, noteSelector, badgeSelector = null) {
    const stability = calculateOperationalStability();
    const donut = qs(donutSelector);
    if (donut) {
      donut.style.setProperty("--stability-score", String(stability.score ?? 0));
      donut.style.setProperty("--stability-color", stability.color);
      donut.classList.toggle("no-data", stability.score === null);
      donut.setAttribute("aria-label", stability.score === null
        ? "Operational stability score unavailable"
        : `Operational stability score ${stability.score} percent, ${stability.label}`);
    }
    setText(scoreSelector, stability.score === null ? null : stability.score);
    setText(labelSelector, stability.label);
    setText(noteSelector, stability.note);
    const badge = badgeSelector ? qs(badgeSelector) : null;
    if (badge) {
      badge.textContent = stability.label;
      badge.className = `status-badge ${stability.score === null ? "neutral" : stability.score >= 82 ? "normal" : stability.score >= 66 ? "neutral" : stability.score >= 48 ? "elevated" : stability.score >= 30 ? "high" : "critical"}`;
    }
    return stability;
  }

  function renderOverview() {
    const latest = getLatestForecast();
    const hybridMetric = findHybridMetric();
    const bestModel = state.performance?.best_test_model;

    setText("#overview-next-forecast", latest ? formatNumber(latest.selected_prediction_kwh, 0) : null);
    setText("#overview-forecast-date", latest ? `${formatDate(latest.forecast_date)} · ${humanize(latest.forecast_type)}` : "No saved forecast");
    setText("#overview-peak-demand", latest ? formatNumber(latest.estimated_peak_demand_kw, 0) : null);
    setText("#overview-capacity-utilization", latest?.capacity_utilization_pct !== null && latest?.capacity_utilization_pct !== undefined ? formatNumber(latest.capacity_utilization_pct, 2) : null);
    setText("#overview-capacity-note", latest?.capacity_utilization_pct !== null && latest?.capacity_utilization_pct !== undefined ? "Estimated peak ÷ available capacity" : "Capacity not provided");
    setText("#overview-demand-level", latest?.demand_level || null);
    applyStatusBadge(qs("#overview-demand-badge"), latest?.demand_level, "No forecast");
    setText("#overview-active-model", bestModel || "—");
    setText("#overview-model-readiness", state.modelStatus?.production_ready ? "All production components loaded" : "Model status requires review");
    setText("#overview-mape", hybridMetric ? formatNumber(hybridMetric.mape_pct, 2) : null);
    setText("#overview-r2", hybridMetric ? formatNumber(hybridMetric.r2, 4) : null);
    setText("#overview-dataset-name", state.activeDataset?.active_dataset_name || null);
    setText("#overview-dataset-period", state.activeDataset?.date_range ? `${state.activeDataset.date_range.start_date} to ${state.activeDataset.date_range.end_date}` : "Loading data coverage");
    renderStabilityIndicator("#overview-stability-donut", "#overview-stability-score", "#overview-stability-label", "#overview-stability-note");

    const recommendationEmpty = qs("#overview-recommendation-empty");
    const recommendationData = qs("#overview-recommendation-data");
    setHidden(recommendationEmpty, Boolean(latest));
    setHidden(recommendationData, !latest);
    if (latest) {
      applyStatusBadge(qs("#overview-recommendation-level"), latest.demand_level);
      setText("#overview-recommendation-basis", `${formatDate(latest.forecast_date, { short: true })} · ${humanize(latest.forecast_type)}`);
      renderTags(qs("#overview-reason-codes"), latest.reason_codes);
      renderActionList(qs("#overview-actions"), latest.recommended_actions);
    }
    renderOverviewConsumptionMap();
    renderOverviewHistoryChart();
    renderOverviewForecastChart();
    renderDemandDistributionChart("overview-demand-chart", "#overview-demand-empty", state.dataSummary?.demand_level_counts || {});
  }

  function renderOverviewHistoryChart() {
    const monthly = state.dataSummary?.monthly_consumption_kwh || {};
    let entries = Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b));
    const range = qs("#overview-history-range")?.value || "12";
    if (range !== "all") entries = entries.slice(-Number(range));
    setHidden("#overview-history-empty", entries.length > 0);
    const type = qs("#overview-history-type")?.value || "line";
    createChart("overview-history-chart", {
      type,
      data: {
        labels: entries.map(([month]) => month),
        datasets: [makeDataset("Monthly consumption (kWh)", entries.map(([, value]) => Number(value)), COLORS.blue, {
          fill: type === "line",
          fillColor: "rgba(30,90,168,.10)",
          pointRadius: entries.length > 30 ? 0 : 2,
        })],
      },
      options: chartBaseOptions({ yTitle: "kWh" }),
    });
  }

  function getLatestSevenDayRecords() {
    const seven = sortHistory(state.history.filter((record) => record.forecast_type === "seven_day_recursive"), "created_desc");
    if (!seven.length) return [];
    const latestCreated = seven[0].created_at;
    const group = seven.filter((record) => Math.abs(parseDate(record.created_at) - parseDate(latestCreated)) < 120000).slice(0, 7);
    const chosen = group.length >= 7 ? group : seven.slice(0, 7);
    return [...chosen].sort((a, b) => String(a.forecast_date).localeCompare(String(b.forecast_date)));
  }

  function renderOverviewForecastChart() {
    const records = getLatestSevenDayRecords();
    setHidden("#overview-forecast-empty", records.length > 0);
    const series = qs("#overview-forecast-series")?.value || "all";
    const datasets = [];
    if (series === "all" || series === "hybrid") {
      if (series === "all") {
        datasets.push(makeDataset("MLR kWh", records.map((r) => r.mlr_prediction_kwh), COLORS.blue2));
        datasets.push(makeDataset("SARIMA kWh", records.map((r) => r.sarima_prediction_kwh), COLORS.purple));
      }
      datasets.push(makeDataset("Hybrid kWh", records.map((r) => r.hybrid_prediction_kwh), COLORS.navy, { borderWidth: 3 }));
    }
    if (series === "peak") {
      datasets.push(makeDataset("Peak demand kW", records.map((r) => r.estimated_peak_demand_kw), COLORS.high, { fill: true }));
    }
    createChart("overview-forecast-chart", {
      type: "line",
      data: { labels: records.map((r) => r.forecast_date), datasets },
      options: chartBaseOptions({ yTitle: series === "peak" ? "kW" : "kWh" }),
    });
  }

  function renderDemandDistributionChart(canvasId, emptySelector, counts) {
    const order = ["NORMAL", "ELEVATED", "HIGH", "CRITICAL"];
    const values = order.map((level) => Number(counts[level] || 0));
    const hasData = values.some((value) => value > 0);
    setHidden(emptySelector, hasData);
    createChart(canvasId, {
      type: "doughnut",
      data: {
        labels: order,
        datasets: [{ data: values, backgroundColor: [COLORS.success, COLORS.elevated, COLORS.high, COLORS.critical], borderColor: "#FFFFFF", borderWidth: 3 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 10, color: COLORS.muted } },
          tooltip: { backgroundColor: COLORS.navy },
        },
      },
    });
  }

  function populateForecastMunicipalitySelects() {
    [qs("#one-municipality"), qs("#seven-municipality")].forEach((select) => {
      if (!select) return;
      const current = select.value;
      clearElement(select);
      select.appendChild(new Option("Select municipality or city", ""));
      MUNICIPALITIES.forEach((item) => select.appendChild(new Option(item.name, item.name)));
      const preferred = state.shortTerm.selectedMunicipality?.name || state.longTerm.selectedMunicipality?.name || current;
      if (preferred) select.value = preferred;
    });
  }

  function pointInRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = Number(ring[i][0]);
      const yi = Number(ring[i][1]);
      const xj = Number(ring[j][0]);
      const yj = Number(ring[j][1]);
      const intersects = ((yi > lat) !== (yj > lat))
        && (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function municipalityFromCoordinates(lat, lng) {
    const features = state.overviewMap.geometry?.features || [];
    for (const feature of features) {
      const rings = featureRings(feature);
      if (rings.some((ring) => pointInRing(lng, lat, ring))) {
        return municipalityByName(feature.properties.municipality);
      }
    }
    return null;
  }

  function updateShortTermLocationSummary() {
    const municipality = state.shortTerm.selectedMunicipality;
    const markerPosition = state.shortTerm.marker?.getLatLng?.();
    setText("#shortterm-selected-municipality", municipality?.name || "Select a location");
    setText("#shortterm-model-scope", municipality ? `${municipality.name} municipality-level MLR–SARIMA` : "Municipality not selected");
    setText("#shortterm-location-coordinates", markerPosition
      ? `${markerPosition.lat.toFixed(5)}, ${markerPosition.lng.toFixed(5)}`
      : "Click inside Sultan Kudarat or detect your current location.");
    setText("#shortterm-location-method", state.shortTerm.locationMethod ? humanize(state.shortTerm.locationMethod) : "No pin");
    setText("#shortterm-weather-source", state.shortTerm.weatherSource || "Not fetched");
    setText("#shortterm-weather-dates", state.shortTerm.weatherDates || "—");
    const profile = municipality ? municipalityProfile(municipality.name) : null;
    setText("#shortterm-population-source", profile?.population ? `${formatNumber(profile.population, 0)} from active dataset` : "Loaded after selection");
    const enabled = Boolean(municipality && markerPosition);
    [qs("#shortterm-fetch-weather-button"), qs("#shortterm-fetch-run-button")].forEach((button) => {
      if (button) button.disabled = !enabled || state.shortTerm.weatherLoading;
    });
  }

  function syncForecastMunicipalitySelection(municipality) {
    const name = municipality?.name || "";
    const oneSelect = qs("#one-municipality");
    const sevenSelect = qs("#seven-municipality");
    if (oneSelect) oneSelect.value = name;
    if (sevenSelect) sevenSelect.value = name;
  }

  function setShortTermSelectedMunicipality(municipality, method) {
    state.shortTerm.selectedMunicipality = municipality;
    state.shortTerm.locationMethod = method;
    state.shortTerm.weatherSource = null;
    state.shortTerm.weatherDates = null;
    state.shortTerm.weatherRows = [];
    syncForecastMunicipalitySelection(municipality);
    updateShortTermLocationSummary();
    setText("#shortterm-automation-status", municipality
      ? `${municipality.name} selected. Fetch weather inputs or run immediately.`
      : "Place a pin or select a municipality marker first.", "");
  }

  async function placeShortTermPin(lat, lng, method = "manual_pin") {
    if (!isInsideLongTermMapBounds(lat, lng)) {
      showToast("Location outside project scope", "Place the pin within Sultan Kudarat.", "error");
      return;
    }
    if (!state.shortTerm.map || !window.L) return;
    if (!state.shortTerm.marker) {
      state.shortTerm.marker = window.L.marker([lat, lng], { draggable: true, autoPan: true }).addTo(state.shortTerm.map);
      state.shortTerm.marker.on("dragend", async (event) => {
        const position = event.target.getLatLng();
        await resolveShortTermPin(position.lat, position.lng, "dragged_pin");
      });
    } else {
      state.shortTerm.marker.setLatLng([lat, lng]);
    }
    state.shortTerm.map.panTo([lat, lng]);
    await resolveShortTermPin(lat, lng, method);
  }

  async function resolveShortTermPin(lat, lng, method) {
    const exact = municipalityFromCoordinates(lat, lng);
    const municipality = exact || nearestMunicipality(lat, lng);
    const resolvedMethod = exact ? `${method}_boundary_match` : `${method}_nearest_center_estimate`;
    setShortTermSelectedMunicipality(municipality, resolvedMethod);
  }

  function clearShortTermPin() {
    if (state.shortTerm.map && state.shortTerm.marker) state.shortTerm.map.removeLayer(state.shortTerm.marker);
    state.shortTerm.marker = null;
    setShortTermSelectedMunicipality(null, null);
    if (state.shortTerm.map) state.shortTerm.map.setView([6.48, 124.52], 8);
  }

  function initializeShortTermMap() {
    if (!window.L || state.shortTerm.map || !qs("#shortterm-map")) return;
    const map = window.L.map("shortterm-map", {
      zoomControl: true,
      minZoom: 7,
      maxZoom: 18,
      maxBounds: [[5.70, 123.60], [7.20, 125.45]],
      maxBoundsViscosity: 0.75,
    });
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    }).addTo(map);
    map.setView([6.48, 124.52], 8);
    map.on("click", (event) => placeShortTermPin(event.latlng.lat, event.latlng.lng, "map_click"));
    MUNICIPALITIES.forEach((item) => {
      const marker = window.L.circleMarker([item.lat, item.lng], {
        radius: 5,
        color: COLORS.navy,
        weight: 1.5,
        fillColor: COLORS.blue,
        fillOpacity: 0.88,
      }).addTo(map);
      marker.bindTooltip(item.name, { direction: "top", offset: [0, -6] });
      marker.on("click", (event) => {
        window.L.DomEvent.stopPropagation(event);
        placeShortTermPin(item.lat, item.lng, "municipality_marker");
      });
    });
    state.shortTerm.map = map;
  }

  function detectShortTermLocation() {
    const button = qs("#shortterm-locate-button");
    if (!navigator.geolocation) {
      showToast("Location unavailable", "This browser does not support geolocation.", "error");
      return;
    }
    setButtonBusy(button, true, "Detecting…");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setButtonBusy(button, false);
        await placeShortTermPin(position.coords.latitude, position.coords.longitude, "browser_geolocation");
      },
      (error) => {
        setButtonBusy(button, false);
        showToast("Location permission failed", error.message || "Allow location access or place the pin manually.", "error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  function isoDateInManila(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date).reduce((values, part) => ({ ...values, [part.type]: part.value }), {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function calculateHeatIndexCelsius(temperatureC, humidityPct) {
    const tempF = Number(temperatureC) * 9 / 5 + 32;
    const humidity = Number(humidityPct);
    if (!Number.isFinite(tempF) || !Number.isFinite(humidity)) return Number(temperatureC);
    let heatF;
    if (tempF < 80) {
      heatF = 0.5 * (tempF + 61 + ((tempF - 68) * 1.2) + (humidity * 0.094));
      heatF = (heatF + tempF) / 2;
    } else {
      heatF = -42.379 + 2.04901523 * tempF + 10.14333127 * humidity
        - 0.22475541 * tempF * humidity - 0.00683783 * tempF ** 2
        - 0.05481717 * humidity ** 2 + 0.00122874 * tempF ** 2 * humidity
        + 0.00085282 * tempF * humidity ** 2 - 0.00000199 * tempF ** 2 * humidity ** 2;
    }
    return Math.max(Number(temperatureC), (heatF - 32) * 5 / 9);
  }

  function yieldToBrowser() {
    return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  async function fetchExternalWeatherJson(url, timeoutMs = 25000, maximumAttempts = 2) {
    let lastError = null;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.error) {
          const serviceError = new Error(payload?.reason || `Weather service returned status ${response.status}.`);
          serviceError.retryable = response.status === 429 || response.status >= 500;
          throw serviceError;
        }
        return payload;
      } catch (error) {
        lastError = error;
        const timedOut = error.name === "AbortError";
        const networkFailure = error instanceof TypeError || /failed to fetch|network/i.test(String(error.message || ""));
        const shouldRetry = attempt < maximumAttempts && (timedOut || networkFailure || error.retryable);
        if (!shouldRetry) {
          if (timedOut) throw new Error("The weather request timed out after two attempts.");
          if (networkFailure) throw new Error("The weather service could not be reached. Check the internet connection and try again.");
          throw error;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 550 * attempt));
      } finally {
        window.clearTimeout(timeout);
      }
    }
    throw lastError || new Error("The weather service could not be reached.");
  }

  function openMeteoUrl(baseUrl, lat, lng, startDate, endDate) {
    const url = new URL(baseUrl);
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);
    url.searchParams.set("daily", OPEN_METEO_DAILY_FIELDS.join(","));
    url.searchParams.set("timezone", "Asia/Manila");
    url.searchParams.set("temperature_unit", "celsius");
    url.searchParams.set("wind_speed_unit", "kmh");
    url.searchParams.set("precipitation_unit", "mm");
    return url.toString();
  }

  function parseOpenMeteoDaily(payload) {
    const daily = payload?.daily || {};
    const dates = daily.time || [];
    const required = ["temperature_2m_mean", "relative_humidity_2m_mean", "precipitation_sum"];
    required.forEach((field) => {
      if (!Array.isArray(daily[field])) throw new Error(`Open-Meteo did not return ${field}.`);
    });
    return dates.map((dateValue, index) => {
      const meanTemp = Number(daily.temperature_2m_mean[index]);
      const humidity = Number(daily.relative_humidity_2m_mean[index]);
      const rainfall = Number(daily.precipitation_sum[index]);
      // Open-Meteo returns null (not a missing key) for dates it has not published yet.
      // Number(null) is 0, so without this check a genuinely missing reading would look
      // like a real "0" measurement and silently continue into the forecast models.
      if (!Number.isFinite(meanTemp) || !Number.isFinite(humidity) || !Number.isFinite(rainfall)) {
        throw new Error(`Open-Meteo has not published complete weather data for ${dateValue} yet. Choose an earlier date or try again later.`);
      }
      const valueOrNull = (field) => {
        const value = Number(daily[field]?.[index]);
        return Number.isFinite(value) ? value : null;
      };
      return {
        date: dateValue,
        temperature_mean_c: meanTemp,
        temperature_min_c: valueOrNull("temperature_2m_min"),
        temperature_max_c: valueOrNull("temperature_2m_max"),
        humidity_mean_pct: humidity,
        rainfall_mm: rainfall,
        heat_index_mean_c: calculateHeatIndexCelsius(meanTemp, humidity),
        wind_speed_mean_kph: valueOrNull("wind_speed_10m_mean"),
        cloud_cover_mean_pct: valueOrNull("cloud_cover_mean"),
      };
    });
  }

  async function fetchOpenMeteoRange(lat, lng, startDate, endDate) {
    const today = isoDateInManila();
    const maximumForecastDate = addDaysIso(today, 15);
    // Dates from this cutoff onward (including the last few days before "today") are
    // requested from the forecast endpoint, not the archive endpoint, because the archive
    // dataset lags real time and would otherwise return incomplete rows for recent dates.
    const archiveCutoff = addDaysIso(today, -OPEN_METEO_RECENT_ARCHIVE_BUFFER_DAYS);
    const segments = [];
    if (startDate < archiveCutoff) {
      const historicalEnd = endDate < archiveCutoff ? endDate : addDaysIso(archiveCutoff, -1);
      segments.push({
        source: "Open-Meteo Historical Weather",
        url: openMeteoUrl(OPEN_METEO_ARCHIVE_URL, lat, lng, startDate, historicalEnd),
      });
    }
    if (endDate >= archiveCutoff) {
      const forecastStart = startDate > archiveCutoff ? startDate : archiveCutoff;
      if (endDate > maximumForecastDate) {
        throw new Error(`Open-Meteo forecasts are available only through ${maximumForecastDate}. Choose an earlier date.`);
      }
      segments.push({
        source: "Open-Meteo Forecast API",
        url: openMeteoUrl(OPEN_METEO_FORECAST_URL, lat, lng, forecastStart, endDate),
      });
    }
    if (!segments.length) throw new Error("No weather date range was selected.");

    const cache = state.shortTerm.weatherCache;
    const segmentRows = await Promise.all(segments.map(async (segment) => {
      let payload = cache.get(segment.url);
      if (!payload) {
        payload = await fetchExternalWeatherJson(segment.url);
        cache.set(segment.url, payload);
        if (cache.size > 24) cache.delete(cache.keys().next().value);
      }
      await yieldToBrowser();
      return parseOpenMeteoDaily(payload).map((row) => ({ ...row, source: segment.source }));
    }));
    const rows = segmentRows.flat();
    const byDate = new Map(rows.map((row) => [row.date, row]));
    // Build a bounded UTC calendar-date range. The previous local-time loop could fail to
    // advance in UTC+08:00 because converting local midnight to ISO returned the prior UTC
    // date, which caused an infinite loop and Chrome's “Page Unresponsive” warning.
    const expectedDates = buildIsoDateRange(startDate, endDate, 16);
    const ordered = expectedDates.map((dateValue) => byDate.get(dateValue));
    const missing = expectedDates.filter((_, index) => !ordered[index]);
    if (missing.length) throw new Error(`Weather data was unavailable for: ${missing.join(", ")}.`);
    const sourceNames = [...new Set(ordered.map((row) => row.source))];
    return { rows: ordered, source: sourceNames.join(" + ") };
  }


  async function fetchNextForecastDate(municipalityName) {
    return apiFetch(`/forecast/next-date?municipality=${encodeURIComponent(municipalityName)}`, {
      timeout: 15000,
    });
  }

  async function fetchOpenMeteoScenarioRange(lat, lng, startDate, endDate, onProgress = null) {
    const expectedDates = buildIsoDateRange(startDate, endDate, 800);
    const today = isoDateInManila();
    const maximumForecastDate = addDaysIso(today, 15);
    const archiveCutoff = addDaysIso(today, -OPEN_METEO_RECENT_ARCHIVE_BUFFER_DAYS);
    const segments = [];
    const archiveEnd = endDate < archiveCutoff ? endDate : addDaysIso(archiveCutoff, -1);

    if (startDate <= archiveEnd) {
      let chunkStart = startDate;
      while (chunkStart <= archiveEnd) {
        const candidateEnd = addDaysIso(chunkStart, 89);
        const chunkEnd = candidateEnd < archiveEnd ? candidateEnd : archiveEnd;
        segments.push({
          source: "Open-Meteo Historical Weather",
          startDate: chunkStart,
          endDate: chunkEnd,
          url: openMeteoUrl(OPEN_METEO_ARCHIVE_URL, lat, lng, chunkStart, chunkEnd),
        });
        chunkStart = addDaysIso(chunkEnd, 1);
      }
    }

    if (endDate >= archiveCutoff) {
      const forecastStart = startDate > archiveCutoff ? startDate : archiveCutoff;
      if (endDate > maximumForecastDate) {
        throw new Error(`Open-Meteo forecasts are available only through ${maximumForecastDate}. Choose an earlier target week.`);
      }
      segments.push({
        source: "Open-Meteo Forecast API",
        startDate: forecastStart,
        endDate,
        url: openMeteoUrl(OPEN_METEO_FORECAST_URL, lat, lng, forecastStart, endDate),
      });
    }

    if (!segments.length) throw new Error("No weather date range was selected for the scenario bridge.");
    const cache = state.shortTerm.weatherCache;
    const collected = [];
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (onProgress) onProgress(index + 1, segments.length, segment);
      await yieldToBrowser();
      let payload = cache.get(segment.url);
      if (!payload) {
        payload = await fetchExternalWeatherJson(segment.url, 30000);
        cache.set(segment.url, payload);
        if (cache.size > 32) cache.delete(cache.keys().next().value);
      }
      const rows = parseOpenMeteoDaily(payload).map((row) => ({ ...row, source: segment.source }));
      collected.push(...rows);
    }

    const byDate = new Map(collected.map((row) => [row.date, row]));
    const ordered = expectedDates.map((dateValue) => byDate.get(dateValue));
    const missing = expectedDates.filter((_, index) => !ordered[index]);
    if (missing.length) {
      throw new Error(`Weather data was unavailable for ${missing.length} bridge date(s). First missing date: ${missing[0]}.`);
    }
    const sources = [...new Set(ordered.map((row) => row.source))];
    return { rows: ordered, source: sources.join(" + "), segmentCount: segments.length };
  }

  function currentWeekScenarioDay(weatherRow, municipality, targetStartDate, targetCapacityByDate) {
    const profile = municipalityProfile(municipality.name);
    const holidayName = fixedPhilippineHoliday(weatherRow.date);
    const day = {
      date: weatherRow.date,
      temperature_mean_c: weatherRow.temperature_mean_c,
      humidity_mean_pct: weatherRow.humidity_mean_pct,
      rainfall_mm: weatherRow.rainfall_mm,
      population: profile?.population || municipality.population,
      customer_count: profile?.customer_count || undefined,
      is_holiday: holidayName ? 1 : 0,
      is_special_event: 0,
    };
    ["temperature_min_c", "temperature_max_c", "heat_index_mean_c", "wind_speed_mean_kph", "cloud_cover_mean_pct"].forEach((field) => {
      const value = Number(weatherRow[field]);
      if (Number.isFinite(value)) day[field] = value;
    });
    if (weatherRow.date >= targetStartDate) {
      const capacity = targetCapacityByDate.get(weatherRow.date);
      if (Number.isFinite(capacity) && capacity > 0) day.available_capacity_kw = capacity;
    }
    if (!Number.isFinite(Number(day.customer_count)) || Number(day.customer_count) <= 0) delete day.customer_count;
    return day;
  }

  function currentDayScenarioDay(weatherRow, municipality, targetDate, targetInputOverride = null) {
    const profile = municipalityProfile(municipality.name);
    const holidayName = fixedPhilippineHoliday(weatherRow.date);
    const day = {
      date: weatherRow.date,
      temperature_mean_c: weatherRow.temperature_mean_c,
      humidity_mean_pct: weatherRow.humidity_mean_pct,
      rainfall_mm: weatherRow.rainfall_mm,
      population: profile?.population || municipality.population,
      customer_count: profile?.customer_count || undefined,
      is_holiday: holidayName ? 1 : 0,
      is_special_event: 0,
    };
    ["temperature_min_c", "temperature_max_c", "heat_index_mean_c", "wind_speed_mean_kph", "cloud_cover_mean_pct"].forEach((field) => {
      const value = Number(weatherRow[field]);
      if (Number.isFinite(value)) day[field] = value;
    });
    if (weatherRow.date === targetDate && targetInputOverride) {
      [
        "temperature_mean_c", "temperature_min_c", "temperature_max_c",
        "humidity_mean_pct", "rainfall_mm", "heat_index_mean_c",
        "wind_speed_mean_kph", "cloud_cover_mean_pct", "population",
        "customer_count", "is_holiday", "is_special_event",
        "available_capacity_kw",
      ].forEach((field) => {
        const value = targetInputOverride[field];
        if (value !== undefined && value !== null && value !== "") day[field] = value;
      });
    }
    if (!Number.isFinite(Number(day.customer_count)) || Number(day.customer_count) <= 0) delete day.customer_count;
    return day;
  }

  async function runCurrentDayGapBridge({
    municipality,
    pin,
    targetDate,
    status,
    targetInputOverride = null,
    populateTargetForm = true,
  }) {
    setText(status, "Checking the municipality model's latest sequential date…", "");
    await yieldToBrowser();
    const nextInfo = await fetchNextForecastDate(municipality.name);
    const bridgeStartDate = nextInfo.next_sequential_date;
    if (targetDate < bridgeStartDate) {
      throw new Error(`This municipality has already advanced beyond that date. The next strict date is ${bridgeStartDate}.`);
    }
    if (targetDate === bridgeStartDate) return null;

    const totalDays = inclusiveDayCount(bridgeStartDate, targetDate);
    const bridgeDays = Math.max(0, totalDays - 1);
    if (totalDays > 800) {
      throw new Error("The missing-history gap exceeds 800 days. Upload newer observed electricity records before forecasting the selected date.");
    }

    setText(status, `Preparing a one-day scenario bridge across ${bridgeDays} missing electricity day${bridgeDays === 1 ? "" : "s"}…`, "");
    await yieldToBrowser();
    const weatherResult = await fetchOpenMeteoScenarioRange(
      pin.lat,
      pin.lng,
      bridgeStartDate,
      targetDate,
      (current, total, segment) => {
        setText(status, `Downloading weather segment ${current} of ${total} (${segment.startDate} to ${segment.endDate})…`, "");
      },
    );

    const targetRow = weatherResult.rows.find((row) => row.date === targetDate);
    if (!targetRow) throw new Error(`Weather data was unavailable for the target date ${targetDate}.`);
    if (populateTargetForm && !targetInputOverride) fillOneDayWeatherInputs(targetRow, municipality);
    state.shortTerm.weatherRows = [targetRow];
    state.shortTerm.weatherSource = weatherResult.source;
    state.shortTerm.weatherDates = targetDate;
    updateShortTermLocationSummary();
    await yieldToBrowser();

    const payload = {
      municipality: municipality.name,
      target_date: targetDate,
      latitude: pin.lat,
      longitude: pin.lng,
      days: weatherResult.rows.map((row) => currentDayScenarioDay(row, municipality, targetDate, targetInputOverride)),
    };

    setText(status, `Running ${totalDays} recursive model step${totalDays === 1 ? "" : "s"} and returning ${targetDate}…`, "");
    await yieldToBrowser();
    const result = await apiFetch("/forecast/current-day", {
      method: "POST",
      body: JSON.stringify(payload),
      timeout: 180000,
    });
    state.latestForecastResult = { mode: "one-day", payload: result };
    renderForecastResult(state.latestForecastResult);
    await refreshHistory();
    renderOverview();
    renderRecommendations();
    renderHistory();
    showToast("Current-day scenario completed", `The system bridged ${result.bridge_days_count} missing day(s) and saved the target forecast.`, "success");
    return result;
  }

  function sevenDayCapacityByDate() {
    const result = new Map();
    qsa("#seven-day-input-body tr").forEach((row) => {
      const dateValue = qs('[data-field="date"]', row)?.value;
      const raw = qs('[data-field="available_capacity_kw"]', row)?.value;
      const capacity = Number(raw);
      if (dateValue && raw !== "" && Number.isFinite(capacity) && capacity > 0) {
        result.set(dateValue, capacity);
      }
    });
    return result;
  }

  async function runCurrentWeekGapBridge({ municipality, pin, targetStartDate, targetEndDate, status }) {
    setText(status, "Checking the municipality model's latest sequential date…", "");
    await yieldToBrowser();
    const nextInfo = await fetchNextForecastDate(municipality.name);
    const bridgeStartDate = nextInfo.next_sequential_date;
    if (targetStartDate < bridgeStartDate) {
      throw new Error(`This municipality has already advanced beyond that date. The next strict date is ${bridgeStartDate}.`);
    }
    if (targetStartDate === bridgeStartDate) return null;

    const bridgeDays = inclusiveDayCount(bridgeStartDate, addDaysIso(targetStartDate, -1));
    const totalDays = inclusiveDayCount(bridgeStartDate, targetEndDate);
    if (totalDays > 800) {
      throw new Error("The missing-history gap exceeds 800 days. Upload newer observed electricity records before forecasting this week.");
    }

    setText(status, `Preparing a scenario bridge across ${bridgeDays} missing electricity day${bridgeDays === 1 ? "" : "s"}…`, "");
    await yieldToBrowser();
    const weatherResult = await fetchOpenMeteoScenarioRange(
      pin.lat,
      pin.lng,
      bridgeStartDate,
      targetEndDate,
      (current, total, segment) => {
        setText(status, `Downloading weather segment ${current} of ${total} (${segment.startDate} to ${segment.endDate})…`, "");
      },
    );

    const targetRows = weatherResult.rows.filter((row) => row.date >= targetStartDate && row.date <= targetEndDate);
    if (targetRows.length !== 7) throw new Error("The current-week weather response did not contain exactly seven target dates.");
    fillSevenDayWeatherInputs(targetRows, municipality);
    state.shortTerm.weatherRows = targetRows;
    state.shortTerm.weatherSource = weatherResult.source;
    state.shortTerm.weatherDates = `${targetStartDate} to ${targetEndDate}`;
    updateShortTermLocationSummary();
    await yieldToBrowser();

    const capacityByDate = sevenDayCapacityByDate();
    const payload = {
      municipality: municipality.name,
      target_start_date: targetStartDate,
      latitude: pin.lat,
      longitude: pin.lng,
      days: weatherResult.rows.map((row) => currentWeekScenarioDay(row, municipality, targetStartDate, capacityByDate)),
    };

    setText(status, `Running ${totalDays} recursive model steps and returning the final seven-day week…`, "");
    await yieldToBrowser();
    const result = await apiFetch("/forecast/current-week", {
      method: "POST",
      body: JSON.stringify(payload),
      timeout: 180000,
    });
    state.latestForecastResult = { mode: "seven-day", payload: result };
    renderForecastResult(state.latestForecastResult);
    await refreshHistory();
    renderOverview();
    renderRecommendations();
    renderHistory();
    showToast("Current-week scenario completed", `The system bridged ${result.bridge_days_count} missing day(s) and saved the seven target forecasts.`, "success");
    return result;
  }

  function fixedPhilippineHoliday(dateValue) {
    const [year, month, day] = dateValue.split("-").map(Number);
    const key = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const fixed = {
      "01-01": "New Year's Day",
      "04-09": "Araw ng Kagitingan",
      "05-01": "Labor Day",
      "06-12": "Independence Day",
      "08-21": "Ninoy Aquino Day",
      "11-01": "All Saints' Day",
      "11-30": "Bonifacio Day",
      "12-08": "Feast of the Immaculate Conception",
      "12-25": "Christmas Day",
      "12-30": "Rizal Day",
      "12-31": "Last Day of the Year",
    };
    if (fixed[key]) return fixed[key];
    const candidate = new Date(Date.UTC(year, 7, 31));
    while (candidate.getUTCDay() !== 1) candidate.setUTCDate(candidate.getUTCDate() - 1);
    const heroesDate = `${candidate.getUTCFullYear()}-${String(candidate.getUTCMonth() + 1).padStart(2, "0")}-${String(candidate.getUTCDate()).padStart(2, "0")}`;
    if (dateValue === heroesDate) return "National Heroes Day";
    return null;
  }

  function setFormInputValue(form, name, value) {
    const input = form?.elements?.namedItem(name);
    if (!input || value === null || value === undefined || !Number.isFinite(Number(value))) return;
    input.value = Number(value).toFixed(name === "population" ? 0 : 1);
  }

  function fillOneDayWeatherInputs(weatherRow, municipality) {
    const form = qs("#one-day-form");
    if (!form) return;
    ["temperature_mean_c", "temperature_min_c", "temperature_max_c", "humidity_mean_pct", "rainfall_mm", "heat_index_mean_c", "wind_speed_mean_kph", "cloud_cover_mean_pct"].forEach((field) => {
      setFormInputValue(form, field, weatherRow[field]);
    });
    const profile = municipalityProfile(municipality.name);
    setFormInputValue(form, "population", profile?.population || municipality.population);
    const holidayName = fixedPhilippineHoliday(weatherRow.date);
    form.elements.namedItem("is_holiday").value = holidayName ? "1" : "0";
    form.elements.namedItem("holiday_name").value = holidayName || "";
  }

  function fillSevenDayWeatherInputs(weatherRows, municipality) {
    const startDate = weatherRows[0]?.date;
    const startInput = qs("#seven-start-date");
    if (startInput && startInput.value !== startDate) {
      startInput.value = startDate;
      buildSevenDayInputs(startDate);
    }
    const profile = municipalityProfile(municipality.name);
    const rows = qsa("#seven-day-input-body tr");
    weatherRows.forEach((weatherRow, index) => {
      const row = rows[index];
      if (!row) return;
      const set = (field, value) => {
        const input = qs(`[data-field="${field}"]`, row);
        if (input && value !== null && value !== undefined && Number.isFinite(Number(value))) input.value = Number(value).toFixed(field === "population" ? 0 : 1);
      };
      ["temperature_mean_c", "temperature_min_c", "temperature_max_c", "humidity_mean_pct", "rainfall_mm", "heat_index_mean_c", "wind_speed_mean_kph", "cloud_cover_mean_pct"].forEach((field) => set(field, weatherRow[field]));
      set("population", profile?.population || municipality.population);
      const holidayName = fixedPhilippineHoliday(weatherRow.date);
      const holiday = qs('[data-field="is_holiday"]', row);
      if (holiday) holiday.value = holidayName ? "1" : "0";
    });
  }

  function currentShortTermDateRange() {
    if (state.forecastMode === "seven-day") {
      const startDate = qs("#seven-start-date")?.value;
      if (!startDate) throw new Error("Choose the seven-day start date first.");
      return { startDate, endDate: addDaysIso(startDate, 6) };
    }
    const dateValue = qs("#one-forecast-date")?.value;
    if (!dateValue) throw new Error("Choose the one-day forecast date first.");
    return { startDate: dateValue, endDate: dateValue };
  }

  function updateWeatherAutomationButton() {
    const button = qs("#shortterm-fetch-run-button");
    if (!button || button.dataset.originalText) return;
    const disabled = button.disabled;
    clearElement(button);
    button.appendChild(createIcon("cloud-lightning"));
    button.appendChild(createElement("span", "", state.forecastMode === "seven-day"
      ? "Fetch weather & run seven-day forecast"
      : "Fetch weather & run one-day forecast"));
    button.disabled = disabled;
    refreshIcons(button);
  }

  async function fetchAndApplyShortTermWeather(runAfter = false) {
    if (state.shortTerm.weatherLoading) return;
    const municipality = state.shortTerm.selectedMunicipality;
    const pin = state.shortTerm.marker?.getLatLng?.();
    if (!municipality || !pin) throw new Error("Select a municipality using the map first.");
    const { startDate, endDate } = currentShortTermDateRange();
    const fetchButton = qs("#shortterm-fetch-weather-button");
    const runButton = qs("#shortterm-fetch-run-button");
    const activeButton = runAfter ? runButton : fetchButton;
    const status = qs("#shortterm-automation-status");
    status.className = "form-status";
    let forecastProgressStarted = false;
    let forecastProgressSuccess = false;
    if (runAfter) {
      beginForecastProgress(state.forecastMode === "seven-day" ? "Preparing seven-day forecast inputs…" : "Preparing one-day forecast inputs…");
      forecastProgressStarted = true;
    }
    state.shortTerm.weatherLoading = true;
    document.body.classList.add("weather-request-active");
    fetchButton?.setAttribute("aria-busy", "true");
    runButton?.setAttribute("aria-busy", "true");
    try {
      setButtonBusy(activeButton, true, runAfter ? "Fetching and running…" : "Fetching weather…");
      if (fetchButton && fetchButton !== activeButton) fetchButton.disabled = true;
      if (runButton && runButton !== activeButton) runButton.disabled = true;
      if (runAfter && state.forecastMode === "one-day") {
        const scenarioResult = await runCurrentDayGapBridge({
          municipality,
          pin,
          targetDate: startDate,
          status,
        });
        if (scenarioResult) {
          status.className = "form-status success";
          setText(status, `Current-day scenario completed after bridging ${scenarioResult.bridge_days_count} missing day(s).`, "");
          forecastProgressSuccess = true;
          return;
        }
      }
      if (runAfter && state.forecastMode === "seven-day") {
        const scenarioResult = await runCurrentWeekGapBridge({
          municipality,
          pin,
          targetStartDate: startDate,
          targetEndDate: endDate,
          status,
        });
        if (scenarioResult) {
          status.className = "form-status success";
          setText(status, `Current-week scenario completed after bridging ${scenarioResult.bridge_days_count} missing day(s).`, "");
          forecastProgressSuccess = true;
          return;
        }
      }

      setText(status, `Requesting weather for ${startDate}${endDate !== startDate ? ` to ${endDate}` : ""}…`, "");
      if (runAfter) updateForecastProgress("Retrieving date-matched weather inputs…");
      await yieldToBrowser();

      const result = await fetchOpenMeteoRange(pin.lat, pin.lng, startDate, endDate);
      state.shortTerm.weatherRows = result.rows;
      state.shortTerm.weatherSource = result.source;
      state.shortTerm.weatherDates = startDate === endDate ? startDate : `${startDate} to ${endDate}`;

      setText(status, "Weather received. Applying the date-matched inputs…", "");
      await yieldToBrowser();
      if (state.forecastMode === "seven-day") fillSevenDayWeatherInputs(result.rows, municipality);
      else fillOneDayWeatherInputs(result.rows[0], municipality);
      await yieldToBrowser();

      updateShortTermLocationSummary();
      status.className = "form-status success";
      setText(status, `${result.source} inputs loaded for ${municipality.name}.`, "");
      showToast("Weather inputs loaded", `${result.rows.length} date-matched weather record${result.rows.length === 1 ? "" : "s"} loaded.`, "success");

      if (runAfter) {
        setText(status, "Weather inputs are ready. Running the municipality forecast…", "");
        updateForecastProgress("Weather ready. Running municipality models…");
        await yieldToBrowser();
        if (state.forecastMode === "seven-day") await submitSevenDayForecast({ preventDefault() {}, currentTarget: qs("#seven-day-form") });
        else await submitOneDayForecast({ preventDefault() {}, currentTarget: qs("#one-day-form") });
        // If the forecast submission above failed, it throws and is handled by the outer
        // catch below, so reaching this line means the run genuinely finished.
        status.className = "form-status success";
        setText(status, "Weather fetched and the forecast completed.", "");
        forecastProgressSuccess = true;
      }
    } catch (error) {
      status.className = "form-status error";
      setText(status, errorMessage(error), "");
      showToast("Weather automation failed", errorMessage(error), "error");
      throw error;
    } finally {
      state.shortTerm.weatherLoading = false;
      document.body.classList.remove("weather-request-active");
      fetchButton?.removeAttribute("aria-busy");
      runButton?.removeAttribute("aria-busy");
      setButtonBusy(activeButton, false);
      updateWeatherAutomationButton();
      updateShortTermLocationSummary();
      if (forecastProgressStarted) endForecastProgress(forecastProgressSuccess, state.forecastMode === "seven-day" ? "Seven-day forecast completed." : "One-day forecast completed.");
    }
  }

  function setupShortTermLocationAutomation() {
    initializeShortTermMap();
    qs("#shortterm-locate-button")?.addEventListener("click", detectShortTermLocation);
    qs("#shortterm-reset-pin-button")?.addEventListener("click", clearShortTermPin);
    qs("#shortterm-fetch-weather-button")?.addEventListener("click", () => fetchAndApplyShortTermWeather(false).catch(() => {}));
    qs("#shortterm-fetch-run-button")?.addEventListener("click", () => fetchAndApplyShortTermWeather(true).catch(() => {}));
    [qs("#one-municipality"), qs("#seven-municipality")].forEach((select) => {
      select?.addEventListener("change", (event) => {
        const municipality = municipalityByName(event.currentTarget.value);
        if (!municipality) return;
        placeShortTermPin(municipality.lat, municipality.lng, "manual_dropdown_selection");
      });
    });
    updateWeatherAutomationButton();
    updateShortTermLocationSummary();
  }

  function setupForecastForms() {
    populateForecastMunicipalitySelects();
    qsa("[data-forecast-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        qsa("[data-forecast-mode]").forEach((item) => item.classList.toggle("active", item === button));
        const oneDay = button.dataset.forecastMode === "one-day";
        state.forecastMode = oneDay ? "one-day" : "seven-day";
        setHidden("#one-day-form-panel", !oneDay);
        setHidden("#seven-day-form-panel", oneDay);
        updateWeatherAutomationButton();
      });
    });
    qs("#one-day-form").addEventListener("submit", (event) => { submitOneDayForecast(event).catch(() => {}); });
    qs("#seven-day-form").addEventListener("submit", (event) => { submitSevenDayForecast(event).catch(() => {}); });
    qs("#reset-one-day-form").addEventListener("click", () => {
      qs("#one-day-form").reset();
      prefillForecastDates();
      setText("#one-day-form-status", "", "");
    });
    qs("#reset-seven-day-form").addEventListener("click", () => {
      qs("#seven-day-form").reset();
      prefillForecastDates();
      buildSevenDayInputs(qs("#seven-start-date").value);
      setText("#seven-day-form-status", "", "");
    });
    qs("#seven-start-date").addEventListener("change", (event) => buildSevenDayInputs(event.target.value));
    qs("#forecast-results-chart-type").addEventListener("change", () => {
      if (state.latestForecastResult) renderForecastResult(state.latestForecastResult);
    });
  }

  function prefillForecastDates() {
    const today = isoDateInManila();
    const oneDate = qs("#one-forecast-date");
    const sevenDate = qs("#seven-start-date");
    if (oneDate) oneDate.value = today;
    if (sevenDate) {
      sevenDate.value = today;
      buildSevenDayInputs(today);
    }
    setText("#one-date-help", "Defaults to the current date. When observed electricity history is missing, WATTZAN automatically runs a recursive gap-bridge scenario.");
  }

  function buildSevenDayInputs(startDate) {
    const body = qs("#seven-day-input-body");
    clearElement(body);
    if (!startDate) return;
    for (let index = 0; index < 7; index += 1) {
      const row = createElement("tr");
      const dateValue = addDaysIso(startDate, index);
      const fields = [
        { name: "date", type: "date", value: dateValue, required: true, readOnly: true },
        { name: "temperature_mean_c", type: "number", min: -10, max: 55, step: .1, required: true },
        { name: "temperature_min_c", type: "number", min: -10, max: 55, step: .1 },
        { name: "temperature_max_c", type: "number", min: -10, max: 55, step: .1 },
        { name: "humidity_mean_pct", type: "number", min: 0, max: 100, step: .1, required: true },
        { name: "rainfall_mm", type: "number", min: 0, max: 1000, step: .1, required: true },
        { name: "heat_index_mean_c", type: "number", min: -10, max: 65, step: .1 },
        { name: "wind_speed_mean_kph", type: "number", min: 0, max: 300, step: .1 },
        { name: "cloud_cover_mean_pct", type: "number", min: 0, max: 100, step: .1 },
        { name: "population", type: "number", min: 1, step: 1 },
      ];
      fields.forEach((field) => {
        const cell = createElement("td");
        const input = createElement("input");
        Object.entries(field).forEach(([key, value]) => {
          if (key === "name") input.dataset.field = value;
          else if (key === "required" || key === "readOnly") input[key] = Boolean(value);
          else input[key] = value;
        });
        input.setAttribute("aria-label", `${humanize(field.name)} for day ${index + 1}`);
        cell.appendChild(input);
        row.appendChild(cell);
      });
      const holidayCell = createElement("td");
      const holidaySelect = createElement("select");
      holidaySelect.dataset.field = "is_holiday";
      holidaySelect.setAttribute("aria-label", `Holiday status for day ${index + 1}`);
      holidaySelect.appendChild(new Option("No", "0"));
      holidaySelect.appendChild(new Option("Yes", "1"));
      holidayCell.appendChild(holidaySelect);
      row.appendChild(holidayCell);

      const capacityCell = createElement("td");
      const capacityInput = createElement("input");
      capacityInput.type = "number";
      capacityInput.min = "0.01";
      capacityInput.step = "0.01";
      capacityInput.dataset.field = "available_capacity_kw";
      capacityInput.setAttribute("aria-label", `Available capacity for day ${index + 1}`);
      capacityCell.appendChild(capacityInput);
      row.appendChild(capacityCell);
      body.appendChild(row);
    }
  }

  function oneDayPayloadFromForm(form) {
    const data = new FormData(form);
    const selectedMunicipality = data.get("municipality") || state.longTerm.selectedMunicipality?.name;
    if (!selectedMunicipality) throw new Error("Select a municipality or place a map pin first.");
    const payload = {
      municipality: selectedMunicipality,
      forecast_date: data.get("forecast_date"),
      temperature_mean_c: safeNumeric(data, "temperature_mean_c", true),
      humidity_mean_pct: safeNumeric(data, "humidity_mean_pct", true),
      rainfall_mm: safeNumeric(data, "rainfall_mm", true),
      heat_index_mean_c: safeNumeric(data, "heat_index_mean_c", true),
      is_holiday: safeNumeric(data, "is_holiday", true),
    };
    ["temperature_min_c", "temperature_max_c", "wind_speed_mean_kph", "cloud_cover_mean_pct", "population", "available_capacity_kw"].forEach((field) => {
      const value = safeNumeric(data, field, false);
      if (value !== undefined) payload[field] = value;
    });
    const holidayName = data.get("holiday_name")?.trim();
    if (holidayName) payload.holiday_name = holidayName;
    const pin = state.shortTerm.marker?.getLatLng?.() || state.longTerm.marker?.getLatLng?.();
    if (pin) { payload.latitude = pin.lat; payload.longitude = pin.lng; }
    return payload;
  }

  async function submitOneDayForecast(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = qs("#run-one-day-button");
    const status = qs("#one-day-form-status");
    status.className = "form-status";
    let progressStarted = false;
    let progressSuccess = false;
    try {
      if (!form.reportValidity()) throw new Error("Fill in every required field before running the forecast.");
      beginForecastProgress("Checking the one-day forecast timeline…");
      progressStarted = true;
      const payload = oneDayPayloadFromForm(form);
      const municipality = municipalityByName(payload.municipality) || {
        name: payload.municipality,
        lat: payload.latitude,
        lng: payload.longitude,
      };
      const selectedPin = state.shortTerm.marker?.getLatLng?.();
      const pin = selectedPin || {
        lat: Number(payload.latitude ?? municipality.lat),
        lng: Number(payload.longitude ?? municipality.lng),
      };
      if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) {
        throw new Error("Select the municipality on the map so weather can be retrieved for a current-date scenario.");
      }

      setButtonBusy(button, true, "Running forecast…");
      setText(status, "Checking the municipality forecast timeline…", "");
      updateForecastProgress("Checking the municipality forecast timeline…");
      const nextInfo = await fetchNextForecastDate(payload.municipality);
      const expectedDate = nextInfo.next_sequential_date;

      if (payload.forecast_date < expectedDate) {
        throw new Error(`The selected date is earlier than the municipality model state. The next available date is ${expectedDate}.`);
      }

      let result;
      if (payload.forecast_date > expectedDate) {
        result = await runCurrentDayGapBridge({
          municipality,
          pin,
          targetDate: payload.forecast_date,
          status,
          targetInputOverride: payload,
          populateTargetForm: false,
        });
      } else {
        setText(status, "Sending inputs to the production models…", "");
        updateForecastProgress("Running the one-day hybrid forecast…");
        result = await apiFetch("/forecast/one-day", { method: "POST", body: JSON.stringify(payload) });
        state.latestForecastResult = { mode: "one-day", payload: result };
        renderForecastResult(state.latestForecastResult);
        await refreshHistory();
        renderOverview();
        renderRecommendations();
        renderHistory();
      }

      status.className = "form-status success";
      const scenario = result.forecast_type === "current_day_gap_bridge_scenario";
      setText(status, scenario
        ? `Current-date scenario completed after bridging ${result.bridge_days_count} missing day(s).`
        : "Forecast completed and saved to history.", "");
      showToast("Forecast completed", `A forecast was saved for ${result.forecast_date}.`, "success");

      const oneDayDateInput = qs("#one-forecast-date");
      if (!scenario) {
        const nextOneDayDate = addDaysIso(result.forecast_date, 1);
        if (oneDayDateInput) oneDayDateInput.value = nextOneDayDate;
        setText("#one-date-help", `Next strict date for ${result.municipality}: ${nextOneDayDate}. Current or later dates run through the recursive scenario bridge.`);
      } else {
        if (oneDayDateInput) oneDayDateInput.value = result.forecast_date;
        setText("#one-date-help", `Current-date scenario used ${result.bridge_days_count} recursively predicted bridge day(s).`);
      }
      progressSuccess = true;
    } catch (error) {
      status.className = "form-status error";
      setText(status, errorMessage(error), "");
      showToast("Forecast failed", errorMessage(error), "error");
      throw error;
    } finally {
      setButtonBusy(button, false);
      if (progressStarted) endForecastProgress(progressSuccess, "One-day forecast completed.");
    }
  }

  function sevenDayPayloadFromForm(form) {
    const startDate = new FormData(form).get("start_date");
    const rows = qsa("#seven-day-input-body tr");
    const days = rows.map((row, rowIndex) => {
      const get = (name) => qs(`[data-field="${name}"]`, row)?.value ?? "";
      const requiredNumber = (name) => {
        const value = Number(get(name));
        if (!Number.isFinite(value)) throw new Error(`${humanize(name)} is required for day ${rowIndex + 1}.`);
        return value;
      };
      const optionalNumber = (name) => {
        const raw = get(name);
        if (raw === "") return undefined;
        const value = Number(raw);
        if (!Number.isFinite(value)) throw new Error(`${humanize(name)} is invalid for day ${rowIndex + 1}.`);
        return value;
      };
      const day = {
        date: get("date"),
        temperature_mean_c: requiredNumber("temperature_mean_c"),
        humidity_mean_pct: requiredNumber("humidity_mean_pct"),
        rainfall_mm: requiredNumber("rainfall_mm"),
        is_holiday: requiredNumber("is_holiday"),
      };
      ["temperature_min_c", "temperature_max_c", "heat_index_mean_c", "wind_speed_mean_kph", "cloud_cover_mean_pct", "population", "available_capacity_kw"].forEach((name) => {
        const value = optionalNumber(name);
        if (value !== undefined) day[name] = value;
      });
      return day;
    });
    const municipality = new FormData(form).get("municipality") || state.longTerm.selectedMunicipality?.name;
    if (!municipality) throw new Error("Select a municipality or place a map pin first.");
    const payload = { municipality, start_date: startDate, days };
    const pin = state.shortTerm.marker?.getLatLng?.() || state.longTerm.marker?.getLatLng?.();
    if (pin) { payload.latitude = pin.lat; payload.longitude = pin.lng; }
    return payload;
  }

  async function submitSevenDayForecast(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = qs("#run-seven-day-button");
    const status = qs("#seven-day-form-status");
    status.className = "form-status";
    let progressStarted = false;
    let progressSuccess = false;
    try {
      if (!form.reportValidity()) throw new Error("Fill in every required field for all seven days before running the forecast.");
      beginForecastProgress("Preparing the seven-day recursive forecast…");
      progressStarted = true;
      const payload = sevenDayPayloadFromForm(form);
      setButtonBusy(button, true, "Running seven-day forecast…");
      setText(status, "Executing recursive daily forecasts…", "");
      updateForecastProgress("Running seven recursive hybrid forecast steps…");
      const result = await apiFetch("/forecast/seven-day", { method: "POST", body: JSON.stringify(payload), timeout: 90000 });
      state.latestForecastResult = { mode: "seven-day", payload: result };
      renderForecastResult(state.latestForecastResult);
      status.className = "form-status success";
      setText(status, "Seven-day forecast completed and saved to history.", "");
      showToast("Seven-day forecast completed", `Seven daily records were saved from ${result.start_date}.`, "success");
      // The backend only accepts the next sequential seven-day window per municipality.
      // Advance the start date now so a follow-up click does not fail against the window
      // that was just used.
      const nextSevenDayStart = addDaysIso(result.start_date, 7);
      const sevenDayStartInput = qs("#seven-start-date");
      if (sevenDayStartInput) {
        sevenDayStartInput.value = nextSevenDayStart;
        buildSevenDayInputs(nextSevenDayStart);
      }
      await refreshHistory();
      renderOverview();
      renderRecommendations();
      renderHistory();
      progressSuccess = true;
    } catch (error) {
      status.className = "form-status error";
      setText(status, errorMessage(error), "");
      showToast("Seven-day forecast failed", errorMessage(error), "error");
      // Re-throw so the automated "Fetch weather & run forecast" flow (which awaits this
      // function) learns the run failed instead of silently treating it as finished.
      throw error;
    } finally {
      setButtonBusy(button, false);
      if (progressStarted) endForecastProgress(progressSuccess, "Seven-day forecast completed.");
    }
  }

  function createMetricCard(label, value, unit = "", note = "") {
    const card = createElement("article", "metric-card");
    const header = createElement("div", "metric-header");
    header.appendChild(createElement("span", "", label));
    card.appendChild(header);
    const strong = createElement("strong", "metric-value", value);
    card.appendChild(strong);
    if (unit) card.appendChild(createElement("span", "metric-unit", unit));
    if (note) card.appendChild(createElement("p", "metric-footnote", note));
    return card;
  }

  function renderForecastResult(resultState) {
    const { mode, payload } = resultState;
    setHidden("#forecast-results", false);
    const metrics = qs("#forecast-result-metrics");
    clearElement(metrics);
    const tablePanel = qs("#seven-day-results-table-panel");
    let level = null;
    let reasons = [];
    let actions = [];
    let warning = payload.data_warning || SYNTHETIC_WARNING;

    if (mode === "one-day") {
      level = payload.demand_level;
      reasons = payload.reason_codes;
      actions = payload.recommended_actions;
      metrics.append(
        createMetricCard("MLR prediction", formatNumber(payload.mlr_prediction_kwh, 0), "kWh"),
        createMetricCard("SARIMA prediction", formatNumber(payload.sarima_prediction_kwh, 0), "kWh"),
        createMetricCard("Hybrid prediction", formatNumber(payload.hybrid_prediction_kwh, 0), "kWh", "Selected operational prediction"),
        createMetricCard("Peak demand", formatNumber(payload.estimated_peak_demand_kw, 0), "kW"),
        createMetricCard("Capacity utilization", payload.capacity_utilization_pct === null ? "Not calculated" : formatNumber(payload.capacity_utilization_pct, 2), payload.capacity_utilization_pct === null ? "" : "%")
      );
      tablePanel.classList.add("hidden");
      renderOneDayResultChart(payload);
      setText("#forecast-results-chart-title", `Forecast for ${formatDate(payload.forecast_date)}`);
      warning = `${payload.data_warning || SYNTHETIC_WARNING}${payload.forecast_limitation ? ` ${payload.forecast_limitation}` : ""}${payload.expert_validation_required ? " Expert validation is required for recommendations." : ""}`;
    } else {
      const daily = payload.daily_forecasts || [];
      const highest = daily.find((day) => day.forecast_date === payload.highest_demand_date) || daily[0];
      level = highest?.demand_level;
      reasons = highest?.reason_codes || [];
      actions = highest?.recommended_actions || [];
      metrics.append(
        createMetricCard("Weekly total", formatNumber(payload.weekly_total_kwh, 0), "kWh"),
        createMetricCard("Daily average", formatNumber(payload.weekly_average_kwh, 0), "kWh"),
        createMetricCard("Highest demand date", formatDate(payload.highest_demand_date, { short: true }), ""),
        createMetricCard("Lowest demand date", formatDate(payload.lowest_demand_date, { short: true }), ""),
        createMetricCard("Maximum utilization", payload.maximum_capacity_utilization_pct === null ? "Not calculated" : formatNumber(payload.maximum_capacity_utilization_pct, 2), payload.maximum_capacity_utilization_pct === null ? "" : "%")
      );
      tablePanel.classList.remove("hidden");
      renderSevenDayResultsTable(daily);
      renderSevenDayResultChart(payload);
      setText("#forecast-results-chart-title", `Seven-day forecast from ${formatDate(payload.start_date)}`);
      warning = `${payload.data_warning || SYNTHETIC_WARNING} ${payload.forecast_limitation || ""}`.trim();
    }
    applyStatusBadge(qs("#forecast-result-level"), level, "No level");
    renderTags(qs("#forecast-result-reasons"), reasons);
    renderActionList(qs("#forecast-result-actions"), actions);
    setText("#forecast-result-warning", warning, SYNTHETIC_WARNING);
    refreshIcons(metrics);
    qs("#forecast-results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderOneDayResultChart(payload) {
    const type = qs("#forecast-results-chart-type").value;
    createChart("forecast-results-chart", {
      type,
      data: {
        labels: ["MLR", "SARIMA", "Hybrid"],
        datasets: [
          makeDataset("Consumption prediction (kWh)", [payload.mlr_prediction_kwh, payload.sarima_prediction_kwh, payload.hybrid_prediction_kwh], COLORS.blue, { type }),
          makeDataset("Estimated peak demand (kW)", [null, null, payload.estimated_peak_demand_kw], COLORS.high, { type: "line", yAxisID: "y1", pointRadius: 5 }),
        ],
      },
      options: chartBaseOptions({ yTitle: "Consumption (kWh)", y1Title: "Peak demand (kW)", beginAtZero: true }),
    });
  }

  function renderSevenDayResultChart(payload) {
    const type = qs("#forecast-results-chart-type").value;
    const days = payload.daily_forecasts || [];
    const highLevels = new Set(["HIGH", "CRITICAL"]);
    const pointColors = days.map((day) => {
      if (String(day.demand_level).toUpperCase() === "CRITICAL") return COLORS.critical;
      if (String(day.demand_level).toUpperCase() === "HIGH") return COLORS.high;
      if (String(day.demand_level).toUpperCase() === "ELEVATED") return COLORS.elevated;
      return COLORS.blue;
    });
    const hasHighDemand = days.some((day) => highLevels.has(String(day.demand_level).toUpperCase()));
    const dataset = {
      label: "Hybrid electricity forecast (kWh)",
      data: days.map((day) => day.hybrid_prediction_kwh),
      borderColor: COLORS.blue,
      backgroundColor: type === "bar" ? pointColors : `${COLORS.blue}24`,
      pointBackgroundColor: pointColors,
      pointBorderColor: "#FFFFFF",
      pointBorderWidth: 2,
      pointRadius: days.map((day) => highLevels.has(String(day.demand_level).toUpperCase()) ? 6 : 4),
      pointHoverRadius: 8,
      borderWidth: 3,
      tension: 0.28,
      fill: type === "line",
    };
    const options = chartBaseOptions({ yTitle: "Hybrid consumption (kWh)", showLegend: true, beginAtZero: false });
    options.plugins.subtitle = {
      display: true,
      text: hasHighDemand
        ? "High and critical demand days are highlighted in orange and red."
        : "No high or critical demand day was classified in this seven-day period.",
      color: hasHighDemand ? COLORS.high : COLORS.muted,
      padding: { bottom: 10 },
      font: { weight: "600", size: 11 },
    };
    createChart("forecast-results-chart", {
      type,
      data: { labels: days.map((day) => day.forecast_date), datasets: [dataset] },
      options,
    });
  }

  function renderSevenDayResultsTable(days) {
    const body = qs("#seven-day-results-body");
    clearElement(body);
    days.forEach((day) => {
      const row = createElement("tr");
      row.append(
        createTableCell(formatDate(day.forecast_date, { short: true })),
        createTableCell(formatNumber(day.mlr_prediction_kwh, 0), "numeric"),
        createTableCell(formatNumber(day.sarima_prediction_kwh, 0), "numeric"),
        createTableCell(formatNumber(day.hybrid_prediction_kwh, 0), "numeric"),
        createTableCell(formatNumber(day.estimated_peak_demand_kw, 0), "numeric"),
        createTableCell(day.capacity_utilization_pct === null ? "—" : formatNumber(day.capacity_utilization_pct, 2), "numeric"),
        createTableCell(day.demand_level),
        createTableCell(normalizeList(day.lag_dates_based_on_predictions).join(", ") || "None", "wrap")
      );
      body.appendChild(row);
    });
  }


  function normalizeMunicipalityName(value) {
    if (!value) return null;
    const cleaned = String(value)
      .toLowerCase()
      .replace(/municipality of|city of|province of|sultan kudarat|philippines/g, " ")
      .replace(/[^a-z. ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const alias = MUNICIPALITY_ALIASES.get(cleaned);
    if (alias) return alias;
    const direct = MUNICIPALITIES.find((item) => item.name.toLowerCase() === cleaned);
    if (direct) return direct.name;
    const partial = MUNICIPALITIES.find((item) => cleaned.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(cleaned));
    return partial?.name || null;
  }

  function municipalityByName(name) {
    return MUNICIPALITIES.find((item) => item.name === name) || null;
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    const toRad = (degrees) => degrees * Math.PI / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function nearestMunicipality(lat, lng) {
    return [...MUNICIPALITIES]
      .map((item) => ({ ...item, distanceKm: haversineKm(lat, lng, item.lat, item.lng) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];
  }

  function isInsideLongTermMapBounds(lat, lng) {
    return lat >= SULTAN_KUDARAT_BOUNDS[0][0] && lat <= SULTAN_KUDARAT_BOUNDS[1][0]
      && lng >= SULTAN_KUDARAT_BOUNDS[0][1] && lng <= SULTAN_KUDARAT_BOUNDS[1][1];
  }

  async function externalJsonFetch(url, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error(`External location service returned ${response.status}.`);
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function reverseGeocodeMunicipality(lat, lng) {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("zoom", "10");
    url.searchParams.set("addressdetails", "1");
    const result = await externalJsonFetch(url.toString());
    const address = result?.address || {};
    const candidates = [
      address.city,
      address.town,
      address.municipality,
      address.county,
      address.city_district,
      address.village,
      result?.display_name,
    ];
    for (const candidate of candidates) {
      const normalized = normalizeMunicipalityName(candidate);
      if (normalized) return municipalityByName(normalized);
    }
    return null;
  }

  function populateLongTermMunicipalitySelect() {
    const select = qs("#longterm-municipality-select");
    if (!select) return;
    clearElement(select);
    select.appendChild(new Option("Select municipality or city", ""));
    MUNICIPALITIES.forEach((item) => select.appendChild(new Option(`${item.name} — ${formatNumber(item.population, 0)} people`, item.name)));
    select.disabled = !state.longTerm.marker;
    if (state.longTerm.selectedMunicipality) select.value = state.longTerm.selectedMunicipality.name;
  }

  function updateLongTermLocationSummary() {
    const selected = state.longTerm.selectedMunicipality;
    const markerLatLng = state.longTerm.marker?.getLatLng?.();
    setText("#longterm-selected-municipality", selected?.name, "No location pinned");
    setText("#longterm-selected-coordinates", markerLatLng ? `${markerLatLng.lat.toFixed(5)}, ${markerLatLng.lng.toFixed(5)}` : null);
    setText("#longterm-selected-population", selected ? formatNumber(selected.population, 0) : null);
    setText("#longterm-selected-share", selected ? formatPercent(selected.population / PROVINCE_2024_POPULATION * 100, 2) : null);
    setText("#longterm-location-method", state.longTerm.locationMethod ? humanize(state.longTerm.locationMethod) : null);
    setText("#longterm-location-type", selected?.type);
    const runButton = qs("#run-longterm-button");
    const status = qs("#longterm-form-status");
    const ready = Boolean(state.longTerm.marker && selected);
    if (runButton) runButton.disabled = !ready;
    if (status && !ready) setText(status, "Place a pin to enable the projection.", "");
    populateLongTermMunicipalitySelect();
  }

  async function loadLongTermMunicipalitySummary(municipalityName) {
    if (!municipalityName) return null;
    const summary = await apiFetch(`/data/summary?municipality=${encodeURIComponent(municipalityName)}`);
    if (state.longTerm.selectedMunicipality?.name === municipalityName) {
      state.longTerm.municipalitySummary = summary;
      prefillLongTermForm();
    }
    return summary;
  }

  function setLongTermSelectedMunicipality(municipality, method) {
    state.longTerm.selectedMunicipality = municipality;
    state.longTerm.municipalitySummary = null;
    state.longTerm.locationMethod = method;
    const oneSelect = qs("#one-municipality");
    const sevenSelect = qs("#seven-municipality");
    if (oneSelect) oneSelect.value = municipality?.name || "";
    if (sevenSelect) sevenSelect.value = municipality?.name || "";
    updateLongTermLocationSummary();
    if (municipality?.name) {
      loadLongTermMunicipalitySummary(municipality.name).catch((error) => {
        console.warn("Municipality summary could not be loaded yet.", error);
      });
    }
  }

  async function resolveLongTermPin(lat, lng, initialMethod) {
    const status = qs("#longterm-form-status");
    setText(status, "Identifying municipality…", "");
    let municipality = null;
    let method = initialMethod;
    try {
      municipality = await reverseGeocodeMunicipality(lat, lng);
      if (municipality) method = `${initialMethod}_openstreetmap`;
    } catch (error) {
      console.warn("Reverse geocoding unavailable; using nearest municipal center.", error);
    }
    if (!municipality) {
      municipality = nearestMunicipality(lat, lng);
      method = `${initialMethod}_nearest_center_estimate`;
    }
    setLongTermSelectedMunicipality(municipality, method);
    setText(status, `Location assigned to ${municipality.name}. Confirm it before running.`, "");
  }

  async function placeLongTermPin(lat, lng, method = "manual_pin") {
    if (!isInsideLongTermMapBounds(lat, lng)) {
      showToast("Location outside project scope", "Place the pin within Sultan Kudarat before running the projection.", "error");
      return;
    }
    const map = state.longTerm.map;
    if (!map || !window.L) return;
    if (!state.longTerm.marker) {
      state.longTerm.marker = window.L.marker([lat, lng], { draggable: true, autoPan: true }).addTo(map);
      state.longTerm.marker.on("dragend", async (event) => {
        const position = event.target.getLatLng();
        await resolveLongTermPin(position.lat, position.lng, "dragged_pin");
      });
    } else {
      state.longTerm.marker.setLatLng([lat, lng]);
    }
    map.panTo([lat, lng]);
    state.longTerm.selectedMunicipality = null;
    state.longTerm.locationMethod = method;
    updateLongTermLocationSummary();
    await resolveLongTermPin(lat, lng, method);
  }

  function clearLongTermPin() {
    if (state.longTerm.map && state.longTerm.marker) state.longTerm.map.removeLayer(state.longTerm.marker);
    state.longTerm.marker = null;
    state.longTerm.selectedMunicipality = null;
    state.longTerm.municipalitySummary = null;
    state.longTerm.locationMethod = null;
    state.longTerm.projection = null;
    setHidden("#longterm-results", true);
    updateLongTermLocationSummary();
    if (state.longTerm.map) state.longTerm.map.setView([6.48, 124.52], 8);
  }

  function initializeLongTermMap() {
    if (!window.L || state.longTerm.map || !qs("#longterm-map")) return;
    const map = window.L.map("longterm-map", {
      zoomControl: true,
      minZoom: 7,
      maxZoom: 18,
      maxBounds: [[5.70, 123.60], [7.20, 125.45]],
      maxBoundsViscosity: 0.75,
    });
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    }).addTo(map);
    map.setView([6.48, 124.52], 8);
    map.on("click", (event) => placeLongTermPin(event.latlng.lat, event.latlng.lng, "map_click"));
    MUNICIPALITIES.forEach((item) => {
      const center = window.L.circleMarker([item.lat, item.lng], {
        radius: 4,
        color: COLORS.blue,
        weight: 1.5,
        fillColor: "#FFFFFF",
        fillOpacity: 1,
      }).addTo(map);
      center.bindTooltip(item.name, { direction: "top", offset: [0, -5] });
      center.on("click", (event) => {
        window.L.DomEvent.stopPropagation(event);
        placeLongTermPin(item.lat, item.lng, "municipal_center_click");
      });
    });
    state.longTerm.map = map;
  }

  function detectLongTermLocation() {
    const button = qs("#longterm-locate-button");
    if (!navigator.geolocation) {
      showToast("Location unavailable", "This browser does not support geolocation.", "error");
      return;
    }
    setButtonBusy(button, true, "Detecting…");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setButtonBusy(button, false);
        await placeLongTermPin(position.coords.latitude, position.coords.longitude, "browser_geolocation");
      },
      (error) => {
        setButtonBusy(button, false);
        showToast("Location permission failed", error.message || "Allow location access or place the pin manually.", "error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  function historicalAnnualEntries(summary = state.dataSummary) {
    const annual = summary?.annual_consumption_kwh || {};
    return Object.entries(annual)
      .map(([year, value]) => ({ year: Number(year), kwh: Number(value) }))
      .filter((item) => Number.isFinite(item.year) && Number.isFinite(item.kwh) && item.kwh > 0)
      .sort((a, b) => a.year - b.year);
  }

  function calculateHistoricalCagrPct() {
    const entries = historicalAnnualEntries(state.longTerm.municipalitySummary || state.dataSummary);
    if (entries.length < 2) return null;
    const first = entries[0];
    const last = entries.at(-1);
    const periods = last.year - first.year;
    if (periods <= 0 || first.kwh <= 0) return null;
    return ((last.kwh / first.kwh) ** (1 / periods) - 1) * 100;
  }

  function prefillLongTermForm() {
    const input = qs("#longterm-demand-growth");
    if (!input || input.dataset.userEdited === "true") return;
    const cagr = calculateHistoricalCagrPct();
    if (Number.isFinite(cagr)) {
      input.value = Math.max(-5, Math.min(15, cagr)).toFixed(2);
      setText("#longterm-growth-help", `Active dataset historical CAGR: ${formatPercent(cagr, 2)}. You may adjust this planning assumption.`, "");
    } else {
      input.value = "3.00";
      setText("#longterm-growth-help", "Historical CAGR was unavailable, so review this assumption before running.", "");
    }
  }

  function numberFromForm(formData, name, required = true) {
    const raw = formData.get(name);
    if ((raw === null || raw === "") && !required) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`${humanize(name)} must be a valid number.`);
    return value;
  }

  function buildMonthlySeasonalShares(latestYear, summary = state.dataSummary) {
    const monthly = summary?.monthly_consumption_kwh || {};
    const monthValues = Array.from({ length: 12 }, (_, index) => {
      const key = `${latestYear}-${String(index + 1).padStart(2, "0")}`;
      return Number(monthly[key]) || 0;
    });
    const total = monthValues.reduce((sum, value) => sum + value, 0);
    if (total <= 0) return Array(12).fill(1 / 12);
    return monthValues.map((value) => value / total);
  }

  function calculateLongTermProjection(form) {
    const selected = state.longTerm.selectedMunicipality;
    if (!selected) throw new Error("Pin and confirm a municipality first.");
    const municipalitySummary = state.longTerm.municipalitySummary;
    if (!municipalitySummary || municipalitySummary.municipality !== selected.name) {
      throw new Error("Municipality history is still loading. Run the projection again in a moment.");
    }
    const annualEntries = historicalAnnualEntries(municipalitySummary);
    if (!annualEntries.length) throw new Error("The selected municipality does not provide annual consumption totals.");
    const formData = new FormData(form);
    const horizon = numberFromForm(formData, "horizon_years");
    const demandGrowthPct = numberFromForm(formData, "demand_growth_pct");
    const climateUpliftPct = numberFromForm(formData, "climate_uplift_pct");
    const efficiencyReductionPct = numberFromForm(formData, "efficiency_reduction_pct");
    const municipalityPopulationGrowthPct = numberFromForm(formData, "municipality_population_growth_pct");
    const loadFactor = numberFromForm(formData, "load_factor");
    const reserveMarginPct = numberFromForm(formData, "reserve_margin_pct");
    const availableCapacityKw = numberFromForm(formData, "available_capacity_kw", false);
    const netGrowthPct = demandGrowthPct + climateUpliftPct - efficiencyReductionPct;
    if (netGrowthPct <= -100) throw new Error("Net annual growth cannot be -100% or lower.");

    const lastHistorical = annualEntries.at(-1);
    const baseYear = lastHistorical.year;
    const currentShare = selected.population / PROVINCE_2024_POPULATION;
    const conservativeGrowth = (netGrowthPct - LONG_TERM_SCENARIO_SPREAD_PCT) / 100;
    const baseGrowth = netGrowthPct / 100;
    const highGrowth = (netGrowthPct + LONG_TERM_SCENARIO_SPREAD_PCT) / 100;
    const municipalityPopGrowth = municipalityPopulationGrowthPct / 100;
    const provincePopGrowth = PROVINCE_POPULATION_GROWTH_PCT / 100;
    const reserveMultiplier = 1 + reserveMarginPct / 100;
    const years = [];

    for (let step = 0; step <= horizon; step += 1) {
      const year = baseYear + step;
      const municipalityPopulation = selected.population * (1 + municipalityPopGrowth) ** step;
      const provincePopulation = PROVINCE_2024_POPULATION * (1 + provincePopGrowth) ** step;
      const share = municipalityPopulation / provincePopulation;
      const conservativeKwh = lastHistorical.kwh * (1 + conservativeGrowth) ** step;
      const baseKwh = lastHistorical.kwh * (1 + baseGrowth) ** step;
      const highKwh = lastHistorical.kwh * (1 + highGrowth) ** step;
      const daysInYear = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
      const peakKw = baseKwh / daysInYear / 24 / loadFactor;
      const requiredCapacityKw = peakKw * reserveMultiplier;
      const capacityUtilizationPct = availableCapacityKw ? peakKw / availableCapacityKw * 100 : null;
      years.push({
        year,
        share,
        municipalityPopulation,
        conservativeKwh,
        baseKwh,
        highKwh,
        peakKw,
        requiredCapacityKw,
        capacityUtilizationPct,
      });
    }

    const seasonalShares = buildMonthlySeasonalShares(baseYear, municipalitySummary);
    return {
      municipality: selected,
      assumptions: {
        horizon,
        demandGrowthPct,
        climateUpliftPct,
        efficiencyReductionPct,
        municipalityPopulationGrowthPct,
        netGrowthPct,
        loadFactor,
        reserveMarginPct,
        availableCapacityKw,
        conservativeGrowthPct: netGrowthPct - LONG_TERM_SCENARIO_SPREAD_PCT,
        highGrowthPct: netGrowthPct + LONG_TERM_SCENARIO_SPREAD_PCT,
      },
      baseYear,
      currentShare,
      historicalAnnual: annualEntries,
      seasonalShares,
      years,
    };
  }

  function renderLongTermProjection(projection) {
    if (!projection?.years?.length) return;
    state.longTerm.projection = projection;
    const first = projection.years[0];
    const last = projection.years.at(-1);
    const cumulativeKwh = projection.years.slice(1).reduce((sum, row) => sum + row.baseKwh, 0);
    setHidden("#longterm-results", false);
    setText("#longterm-results-title", `${projection.municipality.name}: ${projection.baseYear + 1}–${last.year} planning projection`);
    setText("#longterm-base-energy", formatNumber(first.baseKwh / 1e6, 2));
    setText("#longterm-final-energy", formatNumber(last.baseKwh / 1e6, 2));
    setText("#longterm-final-year-note", `Base scenario for ${last.year}`);
    setText("#longterm-net-growth", formatNumber(projection.assumptions.netGrowthPct, 2));
    setText("#longterm-final-peak", formatNumber(last.peakKw / 1000, 2));
    setText("#longterm-required-capacity", formatNumber(last.requiredCapacityKw / 1000, 2));
    setText("#longterm-cumulative-energy", formatNumber(cumulativeKwh / 1e6, 2));
    renderLongTermEnergyChart(projection);
    renderLongTermShareChart(projection);
    renderLongTermCapacityChart(projection);
    renderLongTermMonthlyChart(projection);
    renderLongTermTable(projection);
    refreshIcons(qs("#longterm-results"));
  }

  function renderLongTermEnergyChart(projection) {
    const type = qs("#longterm-energy-chart-type")?.value || "line";
    const historical = projection.historicalAnnual.map((item) => ({ x: String(item.year), y: item.kwh / 1e6 }));
    const futureRows = projection.years;
    const labels = [...new Set([...historical.map((item) => item.x), ...futureRows.map((row) => String(row.year))])];
    const historicalMap = new Map(historical.map((item) => [item.x, item.y]));
    const valueByYear = (field) => {
      const map = new Map(futureRows.map((row) => [String(row.year), row[field] / 1e6]));
      return labels.map((label) => map.get(label) ?? null);
    };
    createChart("longterm-energy-chart", {
      type,
      data: {
        labels,
        datasets: [
          makeDataset("Municipality historical energy (GWh)", labels.map((label) => historicalMap.get(label) ?? null), COLORS.gray, { type: "line", pointRadius: 3 }),
          makeDataset(`Conservative (${formatNumber(projection.assumptions.conservativeGrowthPct, 2)}%)`, valueByYear("conservativeKwh"), COLORS.blue2, { type, hidden: false }),
          makeDataset(`Base (${formatNumber(projection.assumptions.netGrowthPct, 2)}%)`, valueByYear("baseKwh"), COLORS.navy, { type, borderWidth: 3 }),
          makeDataset(`High (${formatNumber(projection.assumptions.highGrowthPct, 2)}%)`, valueByYear("highKwh"), COLORS.purple, { type }),
        ],
      },
      options: chartBaseOptions({ yTitle: "Annual energy (GWh)" }),
    });
  }

  function renderLongTermShareChart(projection) {
    const selectedPct = projection.currentShare * 100;
    createChart("longterm-share-chart", {
      type: "doughnut",
      data: {
        labels: [projection.municipality.name, "Rest of Sultan Kudarat"],
        datasets: [{
          data: [selectedPct, 100 - selectedPct],
          backgroundColor: [COLORS.blue, "#DCE4EC"],
          borderColor: "#FFFFFF",
          borderWidth: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, color: COLORS.muted } },
          tooltip: { backgroundColor: COLORS.navy, callbacks: { label: (context) => `${context.label}: ${formatNumber(context.raw, 2)}%` } },
        },
      },
    });
  }

  function renderLongTermCapacityChart(projection) {
    const rows = projection.years;
    const datasets = [
      makeDataset("Estimated peak demand (MW)", rows.map((row) => row.peakKw / 1000), COLORS.high, { fill: true }),
      makeDataset("Required capacity with reserve (MW)", rows.map((row) => row.requiredCapacityKw / 1000), COLORS.navy, { borderWidth: 3 }),
    ];
    if (projection.assumptions.availableCapacityKw) {
      datasets.push(makeDataset("Entered available capacity (MW)", rows.map(() => projection.assumptions.availableCapacityKw / 1000), COLORS.critical, { borderWidth: 2 }));
    }
    createChart("longterm-capacity-chart", {
      type: "line",
      data: { labels: rows.map((row) => row.year), datasets },
      options: chartBaseOptions({ yTitle: "Capacity (MW)" }),
    });
  }

  function renderLongTermMonthlyChart(projection) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const first = projection.years[0];
    const last = projection.years.at(-1);
    createChart("longterm-monthly-chart", {
      type: "bar",
      data: {
        labels: months,
        datasets: [
          makeDataset(`${first.year} municipal profile`, projection.seasonalShares.map((share) => first.baseKwh * share / 1e6), COLORS.blue2, { type: "bar" }),
          makeDataset(`${last.year} projected profile`, projection.seasonalShares.map((share) => last.baseKwh * share / 1e6), COLORS.navy, { type: "bar" }),
        ],
      },
      options: chartBaseOptions({ yTitle: "Monthly energy (GWh)", beginAtZero: true }),
    });
  }

  function renderLongTermTable(projection) {
    const body = qs("#longterm-results-body");
    clearElement(body);
    projection.years.slice(1).forEach((row) => {
      const tr = createElement("tr");
      tr.append(
        createTableCell(row.year),
        createTableCell(formatPercent(row.share * 100, 2), "numeric"),
        createTableCell(formatNumber(row.conservativeKwh / 1e6, 2), "numeric"),
        createTableCell(formatNumber(row.baseKwh / 1e6, 2), "numeric"),
        createTableCell(formatNumber(row.highKwh / 1e6, 2), "numeric"),
        createTableCell(formatNumber(row.peakKw / 1000, 2), "numeric"),
        createTableCell(formatNumber(row.requiredCapacityKw / 1000, 2), "numeric"),
        createTableCell(row.capacityUtilizationPct === null ? "Not calculated" : formatPercent(row.capacityUtilizationPct, 2), "numeric")
      );
      body.appendChild(tr);
    });
  }

  function exportLongTermProjection() {
    const projection = state.longTerm.projection;
    if (!projection) return;
    const headers = ["year", "municipality", "population_share_pct", "conservative_gwh", "base_gwh", "high_gwh", "estimated_peak_mw", "required_capacity_mw", "capacity_utilization_pct"];
    const rows = projection.years.slice(1).map((row) => [
      row.year,
      projection.municipality.name,
      (row.share * 100).toFixed(4),
      (row.conservativeKwh / 1e6).toFixed(4),
      (row.baseKwh / 1e6).toFixed(4),
      (row.highKwh / 1e6).toFixed(4),
      (row.peakKw / 1000).toFixed(4),
      (row.requiredCapacityKw / 1000).toFixed(4),
      row.capacityUtilizationPct === null ? "" : row.capacityUtilizationPct.toFixed(4),
    ]);
    const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `wattzan_${projection.municipality.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_long_term_projection.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function resetLongTermAssumptions() {
    const form = qs("#longterm-form");
    if (!form) return;
    form.reset();
    qs("#longterm-horizon").value = "10";
    const growthInput = qs("#longterm-demand-growth");
    delete growthInput.dataset.userEdited;
    prefillLongTermForm();
    if (state.longTerm.selectedMunicipality) qs("#longterm-municipality-select").value = state.longTerm.selectedMunicipality.name;
    setText("#longterm-form-status", state.longTerm.selectedMunicipality ? "Assumptions reset. Ready to run." : "Place a pin to enable the projection.", "");
  }

  async function submitLongTermProjection(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = qs("#run-longterm-button");
    const status = qs("#longterm-form-status");
    status.className = "form-status";
    let progressStarted = false;
    let progressSuccess = false;
    try {
      if (!form.reportValidity()) return;
      beginForecastProgress("Loading municipality history for the long-term projection…");
      progressStarted = true;
      setButtonBusy(button, true, "Loading municipality history…");
      const municipalityName = state.longTerm.selectedMunicipality?.name;
      if (!municipalityName) throw new Error("Pin and confirm a municipality first.");
      await loadLongTermMunicipalitySummary(municipalityName);
      setButtonBusy(button, true, "Calculating projection…");
      updateForecastProgress("Calculating long-term planning scenarios…");
      const projection = calculateLongTermProjection(form);
      renderLongTermProjection(projection);
      status.className = "form-status success";
      setText(status, `Projection completed for ${projection.municipality.name}.`, "");
      showToast("Long-term projection completed", `${projection.assumptions.horizon}-year planning scenario generated for ${projection.municipality.name}.`, "success");
      qs("#longterm-results").scrollIntoView({ behavior: "smooth", block: "start" });
      progressSuccess = true;
    } catch (error) {
      status.className = "form-status error";
      setText(status, errorMessage(error), "");
      showToast("Projection failed", errorMessage(error), "error");
    } finally {
      setButtonBusy(button, false);
      updateLongTermLocationSummary();
      if (progressStarted) endForecastProgress(progressSuccess, "Long-term projection completed.");
    }
  }

  function setupLongTermForecast() {
    initializeLongTermMap();
    populateLongTermMunicipalitySelect();
    qs("#longterm-locate-button")?.addEventListener("click", detectLongTermLocation);
    qs("#longterm-reset-pin-button")?.addEventListener("click", clearLongTermPin);
    qs("#longterm-reset-form")?.addEventListener("click", resetLongTermAssumptions);
    qs("#longterm-form")?.addEventListener("submit", submitLongTermProjection);
    qs("#longterm-export-button")?.addEventListener("click", exportLongTermProjection);
    qs("#longterm-energy-chart-type")?.addEventListener("change", () => {
      if (state.longTerm.projection) renderLongTermEnergyChart(state.longTerm.projection);
    });
    qs("#longterm-demand-growth")?.addEventListener("input", (event) => { event.currentTarget.dataset.userEdited = "true"; });
    qs("#longterm-municipality-select")?.addEventListener("change", (event) => {
      const municipality = municipalityByName(event.currentTarget.value);
      if (!municipality || !state.longTerm.marker) return;
      setLongTermSelectedMunicipality(municipality, "manual_municipality_confirmation");
      setText("#longterm-form-status", `Municipality confirmed as ${municipality.name}.`, "");
    });
    updateLongTermLocationSummary();
  }

  function setupDataManagement() {
    const dropZone = qs("#csv-drop-zone");
    const fileInput = qs("#csv-file-input");
    const browseButton = qs("#browse-csv-button");
    browseButton.addEventListener("click", (event) => { event.stopPropagation(); fileInput.click(); });
    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileInput.click(); }
    });
    ["dragenter", "dragover"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
      event.preventDefault(); dropZone.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
      event.preventDefault(); dropZone.classList.remove("dragging");
    }));
    dropZone.addEventListener("drop", (event) => selectCsvFile(event.dataTransfer.files[0]));
    fileInput.addEventListener("change", () => selectCsvFile(fileInput.files[0]));
    qs("#clear-selected-file").addEventListener("click", clearSelectedFile);
    qs("#validate-csv-button").addEventListener("click", validateSelectedCsv);
    qs("#upload-csv-button").addEventListener("click", uploadSelectedCsv);
    qs("#activate-uploaded-dataset").addEventListener("click", activateUploadedDataset);
    qs("#data-annual-chart-type").addEventListener("change", renderDataAnnualChart);
  }

  function selectCsvFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      showToast("Invalid file", "Only CSV files can be validated.", "error");
      return;
    }
    state.selectedFile = file;
    state.validation = null;
    state.uploadedDatasetId = null;
    setHidden("#selected-file-card", false);
    setText("#selected-file-name", file.name);
    setText("#selected-file-size", `${formatNumber(file.size / 1024, 1)} KB`);
    qs("#validate-csv-button").disabled = false;
    qs("#upload-csv-button").disabled = true;
    setHidden("#validation-results", true);
    setHidden("#upload-result", true);
    setText("#data-upload-status", "File selected. Validate it before uploading.", "");
  }

  function clearSelectedFile() {
    state.selectedFile = null;
    state.validation = null;
    state.uploadedDatasetId = null;
    qs("#csv-file-input").value = "";
    setHidden("#selected-file-card", true);
    setHidden("#validation-results", true);
    setHidden("#upload-result", true);
    qs("#validate-csv-button").disabled = true;
    qs("#upload-csv-button").disabled = true;
    setText("#data-upload-status", "", "");
  }

  async function validateSelectedCsv() {
    if (!state.selectedFile) return;
    const button = qs("#validate-csv-button");
    try {
      setButtonBusy(button, true, "Validating…");
      setText("#data-upload-status", "Checking columns, dates, values, and training readiness…", "");
      const body = new FormData();
      body.append("file", state.selectedFile);
      state.validation = await apiFetch("/data/validate", { method: "POST", body });
      renderValidationResults();
      qs("#upload-csv-button").disabled = !state.validation.valid;
      setText("#data-upload-status", state.validation.valid ? "Validation passed. The file can now be uploaded." : "Validation found blocking errors. Correct the file before uploading.", "");
      showToast(state.validation.valid ? "Validation passed" : "Validation failed", state.validation.valid ? "The CSV passed required validation." : `${state.validation.errors?.length || 0} blocking issue(s) were reported.`, state.validation.valid ? "success" : "error");
    } catch (error) {
      setText("#data-upload-status", errorMessage(error), "");
      showToast("Validation failed", errorMessage(error), "error");
    } finally {
      setButtonBusy(button, false);
      qs("#validate-csv-button").disabled = !state.selectedFile;
    }
  }

  function renderValidationResults() {
    const result = state.validation;
    if (!result) return;
    setHidden("#validation-results", false);
    setText("#validation-valid", result.valid ? "YES" : "NO");
    setText("#validation-training-ready", result.training_ready ? "YES" : "NO");
    setText("#validation-rows", formatNumber(result.total_rows, 0));
    setText("#validation-date-range", result.start_date && result.end_date ? `${result.start_date} to ${result.end_date}` : "Unavailable");
    renderIssueTable("#validation-errors-body", "#validation-errors-empty", result.errors || []);
    renderIssueTable("#validation-warnings-body", "#validation-warnings-empty", result.warnings || []);
    setText("#validation-error-count", result.errors?.length || 0);
    setText("#validation-warning-count", result.warnings?.length || 0);

    const expected = inclusiveDayCount(result.start_date, result.end_date);
    const missingDates = result.missing_dates?.length || 0;
    const present = Math.max(0, expected - missingDates);
    createChart("validation-coverage-chart", {
      type: "doughnut",
      data: { labels: ["Dates present", "Missing dates"], datasets: [{ data: [present, missingDates], backgroundColor: [COLORS.blue, COLORS.critical], borderColor: "#FFFFFF", borderWidth: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "bottom", labels: { color: COLORS.muted, usePointStyle: true } } } },
    });

    const missingEntries = Object.entries(result.missing_values || {});
    setHidden("#validation-missing-empty", missingEntries.length > 0);
    createChart("validation-missing-chart", {
      type: "bar",
      data: { labels: missingEntries.map(([column]) => column), datasets: [makeDataset("Missing values", missingEntries.map(([, count]) => Number(count)), COLORS.critical, { type: "bar", fillColor: "rgba(240,68,68,.68)" })] },
      options: chartBaseOptions({ yTitle: "Missing rows", showLegend: false, beginAtZero: true }),
    });
  }

  function renderIssueTable(bodySelector, emptySelector, issues) {
    const body = qs(bodySelector);
    clearElement(body);
    issues.forEach((issue) => {
      const row = createElement("tr");
      row.append(createTableCell(issue.row ?? "—"), createTableCell(issue.column ?? "—"), createTableCell(issue.message ?? "—", "wrap"));
      body.appendChild(row);
    });
    setHidden(emptySelector, issues.length > 0);
  }

  async function uploadSelectedCsv() {
    if (!state.selectedFile || !state.validation?.valid) return;
    const button = qs("#upload-csv-button");
    try {
      setButtonBusy(button, true, "Uploading…");
      const body = new FormData();
      body.append("file", state.selectedFile);
      const result = await apiFetch("/data/upload", { method: "POST", body });
      state.uploadedDatasetId = result.dataset_id;
      setHidden("#upload-result", false);
      setText("#uploaded-dataset-id", result.dataset_id);
      setText("#uploaded-row-count", formatNumber(result.row_count, 0));
      setText("#data-upload-status", "Dataset saved. It is not active until you activate it below.", "");
      showToast("Upload complete", "The validated dataset was saved but not activated.", "success");
    } catch (error) {
      setText("#data-upload-status", errorMessage(error), "");
      showToast("Upload failed", errorMessage(error), "error");
    } finally {
      setButtonBusy(button, false);
      button.disabled = !state.validation?.valid;
    }
  }

  async function activateUploadedDataset() {
    if (!state.uploadedDatasetId) return;
    const button = qs("#activate-uploaded-dataset");
    try {
      setButtonBusy(button, true, "Activating…");
      await apiFetch(`/data/activate/${encodeURIComponent(state.uploadedDatasetId)}`, { method: "POST" });
      await Promise.all([refreshActiveDataset(), refreshSummary()]);
      updateSharedStatus();
      renderDataManagement();
      renderOverview();
      prefillForecastDates();
      showToast("Dataset activated", "The uploaded dataset is now the active historical source.", "success");
    } catch (error) {
      showToast("Activation failed", errorMessage(error), "error");
    } finally {
      setButtonBusy(button, false);
    }
  }

  function renderDataManagement() {
    const dataset = state.activeDataset;
    setText("#data-active-name", dataset?.active_dataset_name);
    setText("#data-active-coverage", dataset?.coverage_area);
    setText("#data-active-range", dataset?.date_range ? `${dataset.date_range.start_date} to ${dataset.date_range.end_date}` : null);
    setText("#data-active-rows", dataset ? formatNumber(dataset.row_count, 0) : null);
    setText("#data-active-target", dataset?.target_column);
    setText("#data-active-synthetic", dataset ? (dataset.is_synthetic ? "Yes" : "No") : null);
    setText("#data-classification-notice", dataset?.data_classification || "Data classification unavailable.");
    renderDataAnnualChart();
    renderDemandDistributionChart("data-demand-chart", "#data-demand-empty", state.dataSummary?.demand_level_counts || {});
  }

  function renderDataAnnualChart() {
    const annual = state.dataSummary?.annual_consumption_kwh || {};
    const entries = Object.entries(annual).sort(([a], [b]) => a.localeCompare(b));
    const type = qs("#data-annual-chart-type")?.value || "bar";
    createChart("data-annual-chart", {
      type,
      data: { labels: entries.map(([year]) => year), datasets: [makeDataset("Annual consumption (kWh)", entries.map(([, value]) => Number(value)), COLORS.blue, { type, fill: type === "line" })] },
      options: chartBaseOptions({ yTitle: "kWh", beginAtZero: true }),
    });
  }

  function setupPerformanceControls() {
    qs("#performance-metric-selector").addEventListener("change", renderPerformanceModelChart);
    qs("#performance-chart-type").addEventListener("change", renderPerformanceModelChart);
    qs("#monthly-metric-selector").addEventListener("change", renderMonthlyPerformanceChart);
  }

  function renderPerformance() {
    const performance = state.performance;
    setText("#performance-best-model", performance?.best_test_model);
    setText("#performance-test-period", performance?.test_period ? `Test period: ${performance.test_period}` : null);
    setText("#performance-test-rows", performance ? formatNumber(performance.test_rows, 0) : null);
    const peakMetric = Array.isArray(performance?.peak_demand_metrics) ? performance.peak_demand_metrics[0] : null;
    setText("#performance-peak-mape", peakMetric ? formatNumber(peakMetric.mape_pct, 2) : null);
    setText("#performance-recommendation-f1", performance?.recommendation_metrics?.macro_f1 !== undefined ? formatNumber(performance.recommendation_metrics.macro_f1, 3) : null);
    renderPerformanceModelChart();
    renderMonthlyPerformanceChart();
    renderPerformanceTable();
    renderSignificanceTable();
    renderRecommendationPerformance();
  }

  function renderPerformanceModelChart() {
    const metrics = state.performance?.model_metrics || [];
    const metric = qs("#performance-metric-selector")?.value || "mape_pct";
    const type = qs("#performance-chart-type")?.value || "bar";
    const labels = {
      mape_pct: "MAPE (%)",
      r2: "R²",
      rmse_kwh: "RMSE (kWh)",
      mae_kwh: "MAE (kWh)",
      mean_error_kwh: "Mean error (kWh)",
    };
    createChart("performance-model-chart", {
      type,
      data: {
        labels: metrics.map((row) => row.model),
        datasets: [makeDataset(labels[metric], metrics.map((row) => Number(row[metric])), COLORS.blue, { type, fillColor: "rgba(47,134,213,.68)", pointRadius: 4 })],
      },
      options: chartBaseOptions({ yTitle: labels[metric], showLegend: false, beginAtZero: metric !== "r2" && metric !== "mean_error_kwh" }),
    });
  }

  function renderMonthlyPerformanceChart() {
    const monthly = state.performance?.monthly_metrics || [];
    const metric = qs("#monthly-metric-selector")?.value || "mape_pct";
    const modelNames = [...new Set(monthly.map((row) => row.model))];
    const months = [...new Set(monthly.map((row) => row.month))].sort();
    const colors = [COLORS.blue2, COLORS.purple, COLORS.navy, COLORS.high, COLORS.gray];
    const datasets = modelNames.map((model, index) => makeDataset(model, months.map((month) => {
      const record = monthly.find((row) => row.model === model && row.month === month);
      return record ? Number(record[metric]) : null;
    }), colors[index % colors.length], { pointRadius: 2, borderWidth: model.toLowerCase().includes("hybrid") ? 3 : 2 }));
    createChart("performance-monthly-chart", {
      type: "line",
      data: { labels: months, datasets },
      options: chartBaseOptions({ yTitle: humanize(metric) }),
    });
  }

  function renderPerformanceTable() {
    const body = qs("#performance-model-body");
    clearElement(body);
    (state.performance?.model_metrics || []).forEach((metric) => {
      const row = createElement("tr");
      row.append(
        createTableCell(metric.model),
        createTableCell(formatNumber(metric.r2, 4), "numeric"),
        createTableCell(formatNumber(metric.rmse_kwh, 2), "numeric"),
        createTableCell(formatNumber(metric.mae_kwh, 2), "numeric"),
        createTableCell(formatNumber(metric.mape_pct, 3), "numeric"),
        createTableCell(formatNumber(metric.mean_error_kwh, 2), "numeric")
      );
      body.appendChild(row);
    });
  }

  function renderSignificanceTable() {
    const body = qs("#performance-significance-body");
    clearElement(body);
    (state.performance?.statistical_tests || []).forEach((test) => {
      const row = createElement("tr");
      row.append(
        createTableCell(test.test, "wrap"),
        createTableCell(test.model_a),
        createTableCell(test.model_b),
        createTableCell(formatNumber(test.mean_absolute_loss_a_minus_b_kwh, 2), "numeric"),
        createTableCell(formatNumber(test.statistic, 4), "numeric"),
        createTableCell(Number(test.p_value) === 0 ? "< 1×10⁻¹⁶" : Number(test.p_value).toExponential(3), "numeric"),
        createTableCell(test.interpretation, "wrap")
      );
      body.appendChild(row);
    });
  }

  function renderRecommendationPerformance() {
    const evaluation = state.performance?.recommendation_metrics || {};
    const report = evaluation.classification_report || {};
    const classes = ["NORMAL", "ELEVATED", "HIGH", "CRITICAL"].filter((key) => report[key]);
    createChart("performance-recommendation-chart", {
      type: "bar",
      data: {
        labels: classes,
        datasets: [makeDataset("F1-score", classes.map((key) => Number(report[key]["f1-score"])), COLORS.blue, { type: "bar", fillColor: "rgba(47,134,213,.72)" })],
      },
      options: {
        ...chartBaseOptions({ yTitle: "F1-score", showLegend: false, beginAtZero: true }),
        scales: { ...chartBaseOptions({ beginAtZero: true }).scales, y: { ...chartBaseOptions({ beginAtZero: true }).scales.y, max: 1 } },
      },
    });
    setText("#performance-recommendation-warning", evaluation.important_warning || "Recommendation labels require expert validation.");
  }

  function compactAssistantForecast(record) {
    if (!record) return null;
    return {
      municipality: record.municipality,
      forecast_date: record.forecast_date,
      forecast_type: record.forecast_type,
      mlr_prediction_kwh: record.mlr_prediction_kwh,
      sarima_prediction_kwh: record.sarima_prediction_kwh,
      hybrid_prediction_kwh: record.hybrid_prediction_kwh,
      selected_prediction_kwh: record.selected_prediction_kwh,
      estimated_peak_demand_kw: record.estimated_peak_demand_kw,
      available_capacity_kw: record.available_capacity_kw,
      capacity_utilization_pct: record.capacity_utilization_pct,
      demand_level: record.demand_level,
      reason_codes: record.reason_codes,
      recommended_actions: record.recommended_actions,
      model_version: record.model_version,
      created_at: record.created_at,
    };
  }

  function assistantFormSnapshot(formSelector) {
    const form = qs(formSelector);
    if (!form) return null;
    const values = {};
    new FormData(form).forEach((value, key) => {
      if (key in values) {
        if (!Array.isArray(values[key])) values[key] = [values[key]];
        values[key].push(value);
      } else {
        values[key] = value;
      }
    });
    return values;
  }

  function selectedAssistantMunicipality() {
    return state.shortTerm.selectedMunicipality
      || state.longTerm.selectedMunicipality
      || qs("#one-municipality")?.value
      || qs("#seven-municipality")?.value
      || getLatestForecast()?.municipality
      || null;
  }

  function buildAssistantContext() {
    const municipality = selectedAssistantMunicipality();
    const profile = municipality
      ? state.municipalityProfiles.find((item) => item.municipality === municipality) || municipalityByName(municipality)
      : null;
    const latest = getLatestForecast();
    const recent = [...state.history]
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
      .slice(0, 12)
      .map(compactAssistantForecast);
    return {
      generated_at: new Date().toISOString(),
      current_page: PAGE_TITLES[state.currentPage] || state.currentPage,
      selected_municipality: municipality,
      selected_municipality_profile: profile,
      active_dataset: state.activeDataset,
      model_status: state.modelStatus,
      model_performance: state.performance,
      latest_saved_forecast: compactAssistantForecast(latest),
      current_forecast_result: state.latestForecastResult,
      recent_saved_forecasts: recent,
      operational_stability: calculateOperationalStability(),
      current_recommendation: latest ? {
        municipality: latest.municipality,
        forecast_date: latest.forecast_date,
        demand_level: latest.demand_level,
        capacity_utilization_pct: latest.capacity_utilization_pct,
        reason_codes: latest.reason_codes,
        recommended_actions: latest.recommended_actions,
      } : null,
      short_term_mode: state.forecastMode,
      one_day_form_inputs: assistantFormSnapshot("#one-day-form"),
      seven_day_form_inputs: assistantFormSnapshot("#seven-day-form"),
      fetched_weather_source: state.shortTerm.weatherSource,
      fetched_weather_dates: state.shortTerm.weatherDates,
      fetched_weather_rows: state.shortTerm.weatherRows?.slice(0, 12) || [],
      long_term_projection: state.longTerm.projection,
      historical_data_summary: state.dataSummary,
      system_health: state.health,
      research_limitations: {
        daily_data_classification: "Research-grade synthetic development data",
        recommendations: "Provisional until expert validation",
        long_term_output: "Planning scenario, not a daily operational forecast",
      },
    };
  }

  function assistantBadge(element, configured, label) {
    if (!element) return;

    // Keep the assistant header clean when the service is available. Status text is
    // shown only when setup or connection attention is required.
    const hideReadyState = configured === true;
    element.hidden = hideReadyState;
    element.setAttribute("aria-hidden", hideReadyState ? "true" : "false");

    if (hideReadyState) {
      element.textContent = "";
      return;
    }

    element.className = `status-badge ${configured === false ? "critical" : "neutral"}`;
    element.textContent = label;
  }

  function renderAssistantStatus() {
    const status = state.assistant.status;
    const configured = status?.configured;
    const label = configured === true
      ? "Assistant ready"
      : configured === false
        ? "Setup required"
        : "Checking…";
    assistantBadge(qs("#assistant-popup-status"), configured, label);
    assistantBadge(qs("#recommendations-assistant-status"), configured, label);
    const dot = qs("#assistant-launcher-dot");
    if (dot) {
      dot.classList.toggle("ready", configured === true);
      dot.classList.toggle("unavailable", configured === false);
    }
    qsa("#assistant-popup-form textarea, #recommendations-assistant-form textarea").forEach((input) => {
      input.disabled = configured === false || state.assistant.sending;
      if (configured === false) input.placeholder = "Configure the assistant API key in backend/.env, then restart WATTZAN.";
      else if (input.id === "assistant-popup-input") input.placeholder = "Ask about the current WATTZAN outputs…";
      else input.placeholder = "Ask about forecasts, recommendations, municipalities, metrics, or system limitations…";
    });
    qsa("[data-assistant-prompt], #assistant-popup-form button[type='submit'], #recommendations-assistant-form button[type='submit']")
      .forEach((button) => { button.disabled = configured === false || state.assistant.sending; });
  }

  async function refreshAssistantStatus() {
    try {
      state.assistant.status = await apiFetch("/chatbot/status", { timeout: 12000 });
    } catch (error) {
      state.assistant.status = { configured: false, available: false, error: errorMessage(error) };
    }
    renderAssistantStatus();
    return state.assistant.status;
  }

  function cleanAssistantResponseText(rawText) {
    const text = String(rawText ?? "").replace(/\r\n?/g, "\n");
    const paragraphs = text.split(/\n\s*\n/);
    const filtered = paragraphs.filter((paragraph) => {
      const normalized = paragraph
        .replace(/\*\*/g, "")
        .replace(/__/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      return !(
        normalized.includes("wattzan is a research project developed by zander nathan deatras")
        && normalized.includes("tacurong city national high school")
        && normalized.includes("research-grade synthetic development data")
        && normalized.includes("live grid measurements")
      );
    });
    return filtered.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function appendAssistantInlineMarkdown(parent, rawText) {
    const text = String(rawText ?? "");
    const tokenPattern = /(`[^`\n]+`|\*\*[^*\n]+?\*\*|__[^_\n]+?__|\*[^*\n]+?\*|_[^_\n]+?_)/g;
    let cursor = 0;
    let match;

    while ((match = tokenPattern.exec(text)) !== null) {
      if (match.index > cursor) parent.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      const token = match[0];
      let element;
      if (token.startsWith("**") || token.startsWith("__")) {
        element = createElement("strong", "", token.slice(2, -2));
      } else if (token.startsWith("`")) {
        element = createElement("code", "", token.slice(1, -1));
      } else {
        element = createElement("em", "", token.slice(1, -1));
      }
      parent.appendChild(element);
      cursor = match.index + token.length;
    }

    if (cursor < text.length) parent.appendChild(document.createTextNode(text.slice(cursor)));
  }

  function assistantMarkdownBlockType(line) {
    if (!line.trim()) return "blank";
    if (/^```/.test(line.trim())) return "code-fence";
    if (/^#{1,6}\s+/.test(line)) return "heading";
    if (/^\s*[-*]\s+/.test(line)) return "unordered-list";
    if (/^\s*\d+[.)]\s+/.test(line)) return "ordered-list";
    if (/^\s*>\s?/.test(line)) return "blockquote";
    if (/^\s*(?:---+|___+)\s*$/.test(line)) return "rule";
    return "paragraph";
  }

  function appendAssistantMarkdown(container, rawText) {
    const lines = String(rawText ?? "").replace(/\r\n?/g, "\n").split("\n");
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      const type = assistantMarkdownBlockType(line);
      if (type === "blank") {
        index += 1;
        continue;
      }

      if (type === "code-fence") {
        const language = line.trim().slice(3).trim();
        const codeLines = [];
        index += 1;
        while (index < lines.length && assistantMarkdownBlockType(lines[index]) !== "code-fence") {
          codeLines.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        const pre = createElement("pre", "assistant-markdown-code-block");
        const code = createElement("code", language ? `language-${language}` : "", codeLines.join("\n"));
        pre.appendChild(code);
        container.appendChild(pre);
        continue;
      }

      if (type === "heading") {
        const heading = createElement("h4", "assistant-markdown-heading");
        appendAssistantInlineMarkdown(heading, line.replace(/^#{1,6}\s+/, ""));
        container.appendChild(heading);
        index += 1;
        continue;
      }

      if (type === "unordered-list" || type === "ordered-list") {
        const list = createElement(type === "unordered-list" ? "ul" : "ol", "assistant-markdown-list");
        while (index < lines.length && assistantMarkdownBlockType(lines[index]) === type) {
          const item = createElement("li");
          const content = lines[index].replace(type === "unordered-list" ? /^\s*[-*]\s+/ : /^\s*\d+[.)]\s+/, "");
          appendAssistantInlineMarkdown(item, content);
          list.appendChild(item);
          index += 1;
        }
        container.appendChild(list);
        continue;
      }

      if (type === "blockquote") {
        const quoteLines = [];
        while (index < lines.length && assistantMarkdownBlockType(lines[index]) === "blockquote") {
          quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
          index += 1;
        }
        const quote = createElement("blockquote", "assistant-markdown-quote");
        quoteLines.forEach((quoteLine, quoteIndex) => {
          if (quoteIndex) quote.appendChild(document.createElement("br"));
          appendAssistantInlineMarkdown(quote, quoteLine);
        });
        container.appendChild(quote);
        continue;
      }

      if (type === "rule") {
        container.appendChild(createElement("hr", "assistant-markdown-rule"));
        index += 1;
        continue;
      }

      const paragraphLines = [];
      while (index < lines.length && assistantMarkdownBlockType(lines[index]) === "paragraph") {
        paragraphLines.push(lines[index]);
        index += 1;
      }
      const paragraph = createElement("p", "assistant-markdown-paragraph");
      paragraphLines.forEach((paragraphLine, paragraphIndex) => {
        if (paragraphIndex) paragraph.appendChild(document.createElement("br"));
        appendAssistantInlineMarkdown(paragraph, paragraphLine);
      });
      container.appendChild(paragraph);
    }
  }

  function assistantMessageElement(message) {
    const wrapper = createElement("div", `assistant-message ${message.role}${message.error ? " error" : ""}`);
    wrapper.dataset.messageId = message.id || "";
    const avatar = createElement("span", "assistant-message-avatar");
    avatar.appendChild(createIcon(message.role === "user" ? "user" : "bot"));
    const bubble = createElement("div", "assistant-message-bubble");
    const content = createElement("div", "assistant-message-content");
    if (message.role === "assistant" && !message.error) {
      if (message.typing) content.textContent = String(message.displayContent ?? "");
      else appendAssistantMarkdown(content, cleanAssistantResponseText(message.content));
    }
    else content.textContent = String(message.content ?? "");
    bubble.appendChild(content);
    if (!message.welcome) {
      bubble.appendChild(createElement("span", "assistant-message-meta", message.role === "user" ? "You" : "WATTZAN Assistant"));
    }
    wrapper.append(avatar, bubble);
    return wrapper;
  }

  function assistantTypingElement() {
    const wrapper = createElement("div", "assistant-message assistant");
    const avatar = createElement("span", "assistant-message-avatar");
    avatar.appendChild(createIcon("bot"));
    const bubble = createElement("div", "assistant-message-bubble");
    const typing = createElement("span", "assistant-typing");
    typing.setAttribute("aria-label", "WATTZAN Assistant is analyzing the dashboard");
    typing.append(createElement("span"), createElement("span"), createElement("span"));
    bubble.appendChild(typing);
    wrapper.append(avatar, bubble);
    return wrapper;
  }

  function renderAssistantMessages() {
    [qs("#assistant-popup-messages"), qs("#recommendations-assistant-messages")].forEach((container) => {
      if (!container) return;
      clearElement(container);
      state.assistant.messages.forEach((message) => container.appendChild(assistantMessageElement(message)));
      if (state.assistant.sending) container.appendChild(assistantTypingElement());
      refreshIcons(container);
      window.requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
    });
    renderAssistantStatus();
  }

  async function animateAssistantResponse(message) {
    const fullText = cleanAssistantResponseText(message.content);
    message.typing = true;
    message.displayContent = "";
    renderAssistantMessages();
    const chunkSize = 8;
    const delayMs = 12;
    for (let index = chunkSize; index < fullText.length; index += chunkSize) {
      if (!state.assistant.messages.includes(message)) return;
      message.displayContent = fullText.slice(0, index);
      qsa(`[data-message-id="${message.id}"] .assistant-message-content`).forEach((content) => {
        content.textContent = message.displayContent;
        content.classList.add("assistant-fast-typing");
        const scroll = content.closest(".assistant-messages");
        if (scroll) scroll.scrollTop = scroll.scrollHeight;
      });
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
    message.typing = false;
    message.displayContent = fullText;
    renderAssistantMessages();
  }

  function setAssistantOpen(open) {
    state.assistant.open = Boolean(open);
    const popover = qs("#assistant-popover");
    const launcher = qs("#assistant-launcher");
    if (state.assistant.transitionTimer) window.clearTimeout(state.assistant.transitionTimer);
    if (launcher) launcher.setAttribute("aria-expanded", String(state.assistant.open));
    if (!popover) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (state.assistant.open) {
      popover.hidden = false;
      window.requestAnimationFrame(() => popover.classList.add("is-open"));
      renderAssistantMessages();
      state.assistant.transitionTimer = window.setTimeout(() => qs("#assistant-popup-input")?.focus(), reducedMotion ? 0 : 180);
      return;
    }

    popover.classList.remove("is-open");
    state.assistant.transitionTimer = window.setTimeout(() => {
      if (!state.assistant.open) popover.hidden = true;
    }, reducedMotion ? 0 : 240);
  }

  function assistantHistoryForRequest() {
    return state.assistant.messages
      .filter((message) => !message.welcome && !message.error)
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.content }));
  }

  function clearAssistantConversation() {
    state.assistant.messages = [
      { id: "assistant-welcome", role: "assistant", content: ASSISTANT_WELCOME, welcome: true },
    ];
    renderAssistantMessages();
  }

  async function sendAssistantQuestion(rawMessage) {
    const message = String(rawMessage || "").trim();
    if (!message || state.assistant.sending) return;
    if (state.assistant.status?.configured === false) {
      showToast("Assistant setup required", "Configure the assistant API key in backend/.env, then restart the server.", "error");
      return;
    }

    const previousHistory = assistantHistoryForRequest();
    const requestId = ++state.assistant.requestSequence;
    state.assistant.messages.push({ id: `user-${requestId}`, role: "user", content: message });
    state.assistant.sending = true;
    qsa("#assistant-popup-input, #recommendations-assistant-input").forEach((input) => { input.value = ""; });
    renderAssistantMessages();

    let responseMessage = null;
    try {
      const response = await apiFetch("/chatbot/message", {
        method: "POST",
        timeout: ASSISTANT_REQUEST_TIMEOUT_MS,
        body: JSON.stringify({
          message,
          history: previousHistory,
          current_page: PAGE_TITLES[state.currentPage] || state.currentPage,
          context: buildAssistantContext(),
        }),
      });
      if (requestId !== state.assistant.requestSequence) return;
      responseMessage = {
        id: `assistant-${requestId}`,
        role: "assistant",
        content: cleanAssistantResponseText(response.reply) || "The assistant returned no text response.",
        typing: true,
        displayContent: "",
      };
      state.assistant.messages.push(responseMessage);
    } catch (error) {
      if (requestId !== state.assistant.requestSequence) return;
      const messageText = errorMessage(error).replace(/gemini/gi, "assistant service");
      state.assistant.messages.push({
        id: `assistant-error-${requestId}`,
        role: "assistant",
        content: `I could not answer this question. ${messageText}`,
        error: true,
      });
      showToast("Assistant request failed", messageText, "error");
      if (error?.status === 503 || error?.status === 401 || error?.status === 403) await refreshAssistantStatus();
    } finally {
      if (requestId === state.assistant.requestSequence) state.assistant.sending = false;
      renderAssistantMessages();
    }

    if (responseMessage && requestId === state.assistant.requestSequence) {
      await animateAssistantResponse(responseMessage);
    }
  }

  function assistantComposerKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function setupAssistant() {
    qs("#assistant-launcher")?.addEventListener("click", () => setAssistantOpen(!state.assistant.open));
    qs("#assistant-close")?.addEventListener("click", () => setAssistantOpen(false));
    qs("#assistant-open-floating")?.addEventListener("click", () => setAssistantOpen(true));
    qs("#assistant-open-recommendations")?.addEventListener("click", async () => {
      setAssistantOpen(false);
      await navigateTo("recommendations");
      qs("#recommendations-assistant-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => qs("#recommendations-assistant-input")?.focus(), 250);
    });
    qsa("[data-assistant-clear]").forEach((button) => button.addEventListener("click", clearAssistantConversation));
    qsa("[data-assistant-prompt]").forEach((button) => button.addEventListener("click", () => {
      setAssistantOpen(button.closest("#assistant-popover") ? true : state.assistant.open);
      sendAssistantQuestion(button.dataset.assistantPrompt);
    }));
    [qs("#assistant-popup-form"), qs("#recommendations-assistant-form")].forEach((form) => {
      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = form.querySelector("textarea");
        sendAssistantQuestion(input?.value);
      });
    });
    qsa("#assistant-popup-input, #recommendations-assistant-input").forEach((input) => input.addEventListener("keydown", assistantComposerKeydown));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.assistant.open) setAssistantOpen(false);
    });
    renderAssistantMessages();
    renderAssistantStatus();
  }

  function renderRecommendations() {
    const latest = getLatestForecast();
    renderStabilityIndicator(
      "#recommendations-stability-donut",
      "#recommendations-stability-score",
      null,
      "#recommendations-stability-note",
      "#recommendations-stability-badge",
    );
    setText("#recommendations-current-level", latest?.demand_level);
    applyStatusBadge(qs("#recommendations-current-badge"), latest?.demand_level, "No forecast");
    setText("#recommendations-current-date", latest ? `${formatDate(latest.forecast_date)} · Saved ${formatDateTime(latest.created_at)}` : "Run a forecast to generate a recommendation.");
    setText("#recommendations-current-consumption", latest ? `${formatNumber(latest.selected_prediction_kwh, 0)} kWh` : null);
    setText("#recommendations-current-peak", latest ? `${formatNumber(latest.estimated_peak_demand_kw, 0)} kW` : null);
    setText("#recommendations-current-capacity", latest?.capacity_utilization_pct !== null && latest?.capacity_utilization_pct !== undefined ? formatPercent(latest.capacity_utilization_pct) : "Not calculated");
    setText("#recommendations-current-type", latest ? humanize(latest.forecast_type) : null);
    const reasonCount = renderTags(qs("#recommendations-reasons"), latest?.reason_codes || []);
    const actionCount = renderActionList(qs("#recommendations-actions"), latest?.recommended_actions || []);
    setHidden("#recommendations-reasons-empty", reasonCount > 0);
    setHidden("#recommendations-actions-empty", actionCount > 0);
    renderRecommendationHistoryCharts();
  }

  function renderRecommendationHistoryCharts() {
    let records = sortHistory(state.history, "date_asc");
    const range = qs("#recommendations-history-range")?.value || "30";
    if (range !== "all") records = records.slice(-Number(range));
    setHidden("#recommendations-history-empty", records.length > 0);
    const levelMap = { NORMAL: 1, ELEVATED: 2, HIGH: 3, CRITICAL: 4 };
    createChart("recommendations-history-chart", {
      type: "line",
      data: { labels: records.map((r) => r.forecast_date), datasets: [makeDataset("Demand level", records.map((r) => levelMap[r.demand_level] || null), COLORS.blue, { pointRadius: 4, borderWidth: 2 })] },
      options: {
        ...chartBaseOptions({ yTitle: "Demand level" }),
        scales: {
          ...chartBaseOptions({}).scales,
          y: {
            min: .5, max: 4.5,
            ticks: { stepSize: 1, color: COLORS.muted, callback: (value) => ({ 1: "Normal", 2: "Elevated", 3: "High", 4: "Critical" }[value] || "") },
            grid: { color: "rgba(214,222,232,.65)" },
          },
        },
      },
    });
    const capacityRecords = records.filter((r) => r.capacity_utilization_pct !== null && r.capacity_utilization_pct !== undefined);
    setHidden("#recommendations-capacity-empty", capacityRecords.length > 0);
    createChart("recommendations-capacity-chart", {
      type: "line",
      data: { labels: capacityRecords.map((r) => r.forecast_date), datasets: [makeDataset("Capacity utilization (%)", capacityRecords.map((r) => Number(r.capacity_utilization_pct)), COLORS.high, { fill: true, fillColor: "rgba(255,122,26,.16)" })] },
      options: chartBaseOptions({ yTitle: "%" }),
    });
  }

  function setupHistory() {
    qs("#history-filter-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await refreshHistory(getHistoryQuery());
        renderHistory();
      } catch (error) {
        showToast("History request failed", errorMessage(error), "error");
      }
    });
    qs("#reset-history-filters").addEventListener("click", async () => {
      qs("#history-filter-form").reset();
      qs("#history-sort-select").value = "created_desc";
      await refreshHistory();
      renderHistory();
    });
    qs("#history-sort-select").addEventListener("change", renderHistory);
    qs("#history-chart-series").addEventListener("change", renderHistoryChart);
    qs("#recommendations-history-range").addEventListener("change", renderRecommendationHistoryCharts);
    qs("#close-forecast-modal").addEventListener("click", () => qs("#forecast-detail-modal").close());
  }

  function getHistoryQuery() {
    const form = qs("#history-filter-form");
    const data = new FormData(form);
    const params = new URLSearchParams({ limit: "1000" });
    ["start_date", "end_date", "demand_level", "forecast_type"].forEach((key) => {
      const value = data.get(key);
      if (value) params.set(key, value);
    });
    return params.toString();
  }

  function renderHistory() {
    const sortMode = qs("#history-sort-select")?.value || "created_desc";
    state.filteredHistory = sortHistory(state.history, sortMode);
    renderHistoryTable();
    renderHistoryChart();
    const records = state.filteredHistory;
    const values = records.map((record) => Number(record.selected_prediction_kwh)).filter(Number.isFinite);
    setText("#history-record-count", formatNumber(records.length, 0));
    setText("#history-average-forecast", values.length ? `${formatNumber(values.reduce((a, b) => a + b, 0) / values.length, 0)} kWh` : null);
    setText("#history-highest-forecast", values.length ? `${formatNumber(Math.max(...values), 0)} kWh` : null);
    setText("#history-critical-count", formatNumber(records.filter((r) => r.demand_level === "CRITICAL").length, 0));
  }

  function renderHistoryTable() {
    const body = qs("#history-table-body");
    clearElement(body);
    setText("#history-table-count", state.filteredHistory.length);
    setHidden("#history-table-empty", state.filteredHistory.length > 0);
    state.filteredHistory.forEach((record) => {
      const row = createElement("tr");
      row.append(
        createTableCell(formatDate(record.forecast_date, { short: true })),
        createTableCell(humanize(record.forecast_type)),
        createTableCell(formatNumber(record.selected_prediction_kwh, 0), "numeric"),
        createTableCell(formatNumber(record.estimated_peak_demand_kw, 0), "numeric"),
        createTableCell(record.capacity_utilization_pct === null ? "—" : formatNumber(record.capacity_utilization_pct, 2), "numeric")
      );
      const levelCell = createElement("td");
      const badge = createElement("span");
      applyStatusBadge(badge, record.demand_level);
      levelCell.appendChild(badge);
      row.appendChild(levelCell);
      row.append(createTableCell(record.model_version), createTableCell(formatDateTime(record.created_at)));
      const actionCell = createElement("td", "table-actions");
      const view = createElement("button", "button secondary small", "View");
      view.type = "button";
      view.addEventListener("click", () => showForecastDetails(record.forecast_id));
      const remove = createElement("button", "button danger small", "Delete");
      remove.type = "button";
      remove.addEventListener("click", () => deleteForecast(record.forecast_id));
      actionCell.append(view, remove);
      row.appendChild(actionCell);
      body.appendChild(row);
    });
  }

  function renderHistoryChart() {
    const records = [...state.filteredHistory].sort((a, b) => String(a.forecast_date).localeCompare(String(b.forecast_date)));
    setHidden("#history-chart-empty", records.length > 0);
    const mode = qs("#history-chart-series")?.value || "selected";
    const datasets = [];
    let yTitle = "kWh";
    if (mode === "models") {
      datasets.push(makeDataset("MLR kWh", records.map((r) => r.mlr_prediction_kwh), COLORS.blue2));
      datasets.push(makeDataset("SARIMA kWh", records.map((r) => r.sarima_prediction_kwh), COLORS.purple));
      datasets.push(makeDataset("Hybrid kWh", records.map((r) => r.hybrid_prediction_kwh), COLORS.navy, { borderWidth: 3 }));
    } else if (mode === "peak") {
      yTitle = "kW";
      datasets.push(makeDataset("Peak demand kW", records.map((r) => r.estimated_peak_demand_kw), COLORS.high, { fill: true }));
    } else if (mode === "capacity") {
      yTitle = "%";
      datasets.push(makeDataset("Capacity utilization (%)", records.map((r) => r.capacity_utilization_pct), COLORS.critical, { fill: true }));
    } else {
      datasets.push(makeDataset("Selected prediction (kWh)", records.map((r) => r.selected_prediction_kwh), COLORS.blue, { fill: true }));
    }
    createChart("history-trend-chart", {
      type: "line",
      data: { labels: records.map((r) => r.forecast_date), datasets },
      options: chartBaseOptions({ yTitle }),
    });
  }

  async function showForecastDetails(forecastId) {
    try {
      const record = await apiFetch(`/forecast/history/${encodeURIComponent(forecastId)}`);
      const container = qs("#forecast-detail-content");
      clearElement(container);
      const summary = createElement("div", "definition-grid");
      const definitions = [
        ["Forecast date", formatDate(record.forecast_date)],
        ["Forecast type", humanize(record.forecast_type)],
        ["MLR prediction", `${formatNumber(record.mlr_prediction_kwh, 2)} kWh`],
        ["SARIMA prediction", `${formatNumber(record.sarima_prediction_kwh, 2)} kWh`],
        ["Hybrid prediction", `${formatNumber(record.hybrid_prediction_kwh, 2)} kWh`],
        ["Peak demand", `${formatNumber(record.estimated_peak_demand_kw, 2)} kW`],
        ["Capacity utilization", record.capacity_utilization_pct === null ? "Not calculated" : formatPercent(record.capacity_utilization_pct)],
        ["Demand level", record.demand_level],
        ["Model version", record.model_version],
        ["Created", formatDateTime(record.created_at)],
      ];
      definitions.forEach(([term, value]) => {
        const wrapper = createElement("div");
        wrapper.append(createElement("dt", "", term), createElement("dd", "", value));
        summary.appendChild(wrapper);
      });
      const summarySection = createElement("section", "modal-section");
      summarySection.append(createElement("h3", "", "Forecast summary"), summary);
      container.appendChild(summarySection);

      const reasonsSection = createElement("section", "modal-section");
      reasonsSection.appendChild(createElement("h3", "", "Reason codes"));
      const tags = createElement("div", "tag-list");
      renderTags(tags, record.reason_codes);
      reasonsSection.appendChild(tags);
      container.appendChild(reasonsSection);

      const actionsSection = createElement("section", "modal-section");
      actionsSection.appendChild(createElement("h3", "", "Recommended actions"));
      const actions = createElement("ul", "action-list");
      renderActionList(actions, record.recommended_actions);
      actionsSection.appendChild(actions);
      container.appendChild(actionsSection);

      const inputSection = createElement("section", "modal-section");
      inputSection.appendChild(createElement("h3", "", "Input data"));
      const pre = createElement("pre", "notice-box");
      pre.textContent = JSON.stringify(record.input_data || {}, null, 2);
      inputSection.appendChild(pre);
      container.appendChild(inputSection);
      qs("#forecast-detail-modal").showModal();
    } catch (error) {
      showToast("Could not load forecast", errorMessage(error), "error");
    }
  }

  async function deleteForecast(forecastId) {
    const confirmed = window.confirm("Delete this forecast record? This action removes only the selected record.");
    if (!confirmed) return;
    try {
      await apiFetch(`/forecast/history/${encodeURIComponent(forecastId)}`, { method: "DELETE" });
      await refreshHistory(getHistoryQuery());
      renderHistory();
      renderOverview();
      renderRecommendations();
      showToast("Forecast deleted", "The selected forecast record was removed.", "success");
    } catch (error) {
      showToast("Delete failed", errorMessage(error), "error");
    }
  }

  function renderSystemInformation() {
    const health = state.health;
    const status = state.modelStatus;
    setText("#system-app-name", health?.application);
    setText("#system-app-version", health?.version ? `Version ${health.version} · ${health.timezone || "Asia/Manila"}` : null);
    setText("#system-database-status", health?.database ? humanize(health.database) : null);
    setText("#system-production-ready", status ? (status.production_ready ? "YES" : "NO") : null);
    setText("#system-target-variable", status?.target_variable);
    setText("#system-training-period", status?.training_period);
    setText("#system-validation-period", status?.validation_period);
    setText("#system-test-period", status?.test_period);
    setText("#system-synthetic-warning", status?.synthetic_data_warning || SYNTHETIC_WARNING);
    setText("#system-forecast-limitation", status?.forecast_limitations);
    renderSystemArtifacts();
  }

  function renderSystemArtifacts() {
    const status = state.modelStatus || {};
    const components = [
      ["MLR", status.mlr],
      ["SARIMA", status.sarima],
      ["Hybrid MLR–SARIMA", status.hybrid],
      ["Peak-demand estimator", status.peak_demand_estimator],
      ["Recommendation engine", status.recommendation_engine],
    ];
    const body = qs("#system-artifacts-body");
    clearElement(body);
    components.forEach(([name, component]) => {
      const row = createElement("tr");
      const files = component?.artifact_files || (component?.artifact_file ? [component.artifact_file] : []);
      row.append(createTableCell(name));
      const loadedCell = createElement("td");
      const badge = createElement("span", `status-badge ${component?.loaded ? "normal" : "critical"}`, component?.loaded ? "Loaded" : "Unavailable");
      loadedCell.appendChild(badge);
      row.append(loadedCell, createTableCell(files.join(", ") || "—", "wrap"), createTableCell(component?.detail || "—", "wrap"));
      body.appendChild(row);
    });

    const loaded = components.filter(([, component]) => component?.loaded).length;
    createChart("system-readiness-chart", {
      type: "doughnut",
      data: { labels: ["Loaded", "Unavailable"], datasets: [{ data: [loaded, components.length - loaded], backgroundColor: [COLORS.success, COLORS.critical], borderColor: "#FFFFFF", borderWidth: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "64%", plugins: { legend: { position: "bottom", labels: { usePointStyle: true, color: COLORS.muted } }, tooltip: { backgroundColor: COLORS.navy } } },
    });

    const list = qs("#system-loaded-files");
    clearElement(list);
    const files = status.loaded_artifact_file_names || [];
    files.forEach((file) => list.appendChild(createElement("li", "", file)));
    setHidden("#system-loaded-files-empty", files.length > 0);
  }

  function setupOverviewConsumptionMap() {
    qs("#overview-map-year")?.addEventListener("change", (event) => {
      state.overviewMap.year = event.currentTarget.value;
      renderOverviewConsumptionMap();
    });
    qs("#overview-map-reset")?.addEventListener("click", () => {
      closeOverviewMapPopup();
      resetOverview3DCamera();
    });
    qs("#overview-map-popup-close")?.addEventListener("click", () => closeOverviewMapPopup());
    qs("#overview-map-open-forecast")?.addEventListener("click", async () => {
      const name = state.overviewMap.selectedMunicipality;
      if (!name) return;
      const oneSelect = qs("#one-municipality");
      const sevenSelect = qs("#seven-municipality");
      if (oneSelect) oneSelect.value = name;
      if (sevenSelect) sevenSelect.value = name;
      await navigateTo("forecast");
      const municipality = municipalityByName(name);
      if (municipality) await placeShortTermPin(municipality.lat, municipality.lng, "overview_map_selection");
      if (oneSelect) oneSelect.value = name;
      if (sevenSelect) sevenSelect.value = name;
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.overviewMap.selectedMunicipality) closeOverviewMapPopup();
    });
    window.addEventListener("resize", () => {
      window.clearTimeout(state.overviewMap.resizeTimer);
      state.overviewMap.resizeTimer = window.setTimeout(() => {
        if (state.currentPage === "overview") resizeOverview3DRenderer();
      }, 160);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopOverview3DAutoRotate();
      else if (state.currentPage === "overview") startOverview3DAutoRotate();
    });
  }

  function setupSharedControls() {
    qsa("[data-refresh-page]").forEach((button) => button.addEventListener("click", () => refreshPage(button.dataset.refreshPage)));
    qsa("[data-reset-chart]").forEach((button) => button.addEventListener("click", () => resetChart(button.dataset.resetChart)));
    qs("#retry-global-button").addEventListener("click", async () => {
      try { await loadCoreData(); showToast("Connection restored", "The backend is reachable again.", "success"); }
      catch (error) { showToast("Still unavailable", errorMessage(error), "error"); }
    });
    qs("#overview-history-range").addEventListener("change", renderOverviewHistoryChart);
    qs("#overview-history-type").addEventListener("change", renderOverviewHistoryChart);
    qs("#overview-forecast-series").addEventListener("change", renderOverviewForecastChart);
  }

  function addSpinStyle() {
    const style = document.createElement("style");
    style.textContent = ".spin-icon{animation:wattzan-spin .8s linear infinite}@keyframes wattzan-spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(style);
  }

  async function initialize() {
    setCurrentDate();
    addSpinStyle();
    setupNavigation();
    setupOverviewConsumptionMap();
    setupSharedControls();
    setupForecastForms();
    setupShortTermLocationAutomation();
    setupLongTermForecast();
    setupDataManagement();
    setupPerformanceControls();
    setupHistory();
    setupAssistant();
    refreshIcons();
    buildSevenDayInputs("");
    try {
      await loadCoreData();
      await refreshAssistantStatus();
    } catch (error) {
      setApiConnection(false, errorMessage(error));
      showToast("Backend unavailable", errorMessage(error), "error");
    }
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
