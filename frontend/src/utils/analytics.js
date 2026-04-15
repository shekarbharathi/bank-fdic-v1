const GA_SCRIPT_ID = 'ga4-analytics-script';
const USER_ID_KEY = 'bankstatz_user_pseudo_id';
const SESSION_ID_KEY = 'bankstatz_session_id';
const SESSION_START_KEY = 'bankstatz_session_start_ts';
const EVENT_VERSION = 'v1';
const HEARTBEAT_MS = 30000;
const CAPTURE_QUERY_TEXT =
  String(import.meta.env.VITE_GA4_CAPTURE_QUERY_TEXT || 'false').toLowerCase() === 'true';

const INPUT_EDIT_SAMPLE_RATE = 0.25;

const ALLOWED_PARAM_KEYS = new Set([
  'event_version',
  'session_id',
  'user_pseudo_id',
  'view_name',
  'component',
  'element_id',
  'action',
  'context',
  'active_ms',
  'total_ms',
  'dwell_ms',
  'visibility_state',
  'input_id',
  'char_count',
  'token_estimate',
  'has_with_clause',
  'selected_metric_count',
  'row_count',
  'column_count',
  'metric_count',
  'sort_key',
  'sort_direction',
  'sort_kind',
  'viz_mode',
  'status_phase',
  'has_results',
  'error_state',
  'tab_name',
  'result_type',
  'count',
  'group_count',
  'query_text',
  'viz_component',
  'viz_type',
]);

let measurementId = '';
let analyticsEnabled = false;
let scriptLoaded = false;
let heartbeatTimer = null;
let initialized = false;
let activeStartTs = Date.now();
let activeMs = 0;
let eventQueue = [];

const viewTimers = new Map();

const now = () => Date.now();

const randomId = () =>
  `${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

const getOrCreateStorageValue = (key, factory) => {
  if (typeof window === 'undefined') return factory();
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = factory();
  window.localStorage.setItem(key, created);
  return created;
};

const getSessionStart = () => {
  if (typeof window === 'undefined') return now();
  const existing = Number(window.sessionStorage.getItem(SESSION_START_KEY));
  if (Number.isFinite(existing) && existing > 0) return existing;
  const ts = now();
  window.sessionStorage.setItem(SESSION_START_KEY, String(ts));
  return ts;
};

const getSessionId = () => {
  if (typeof window === 'undefined') return randomId();
  return getOrCreateStorageValue(SESSION_ID_KEY, randomId);
};

const getUserPseudoId = () => {
  if (typeof window === 'undefined') return randomId();
  return getOrCreateStorageValue(USER_ID_KEY, randomId);
};

const sanitizeParams = (params = {}) => {
  const clean = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (!ALLOWED_PARAM_KEYS.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'boolean') clean[key] = value ? 1 : 0;
    else if (typeof value === 'number') clean[key] = Number.isFinite(value) ? value : 0;
    else if (typeof value === 'string') clean[key] = value.slice(0, 120);
  }
  clean.event_version = EVENT_VERSION;
  clean.session_id = getSessionId();
  clean.user_pseudo_id = getUserPseudoId();
  return clean;
};

const canSendEvents = () =>
  analyticsEnabled &&
  scriptLoaded &&
  typeof window !== 'undefined' &&
  typeof window.gtag === 'function';

const flushQueue = () => {
  if (!canSendEvents()) return;
  for (const item of eventQueue) {
    window.gtag('event', item.name, item.params);
  }
  eventQueue = [];
};

const sendEventInternal = (name, params) => {
  const payload = { name, params: sanitizeParams(params) };
  if (!canSendEvents()) {
    eventQueue.push(payload);
    return;
  }
  window.gtag('event', payload.name, payload.params);
};

const updateActiveTime = () => {
  const ts = now();
  activeMs += Math.max(0, ts - activeStartTs);
  activeStartTs = ts;
};

const totalMs = () => Math.max(0, now() - getSessionStart());

export function trackEvent(name, params = {}, options = {}) {
  if (!name) return;
  if (options.sampleRate && Math.random() > options.sampleRate) return;
  sendEventInternal(name, params);
}

export function trackInputEdit(params = {}) {
  trackEvent('input_edit', params, { sampleRate: INPUT_EDIT_SAMPLE_RATE });
}

export function getAnalyticsQueryText(text) {
  if (!CAPTURE_QUERY_TEXT) return undefined;
  return String(text || '').slice(0, 120);
}

export function startViewTimer(viewName, baseParams = {}) {
  if (!viewName) return () => {};
  const key = `${viewName}-${randomId()}`;
  viewTimers.set(key, now());
  trackEvent('view_impression_start', { view_name: viewName, ...baseParams });
  return () => {
    const startTs = viewTimers.get(key);
    if (!startTs) return;
    const dwell = Math.max(0, now() - startTs);
    trackEvent('view_impression_end', {
      view_name: viewName,
      dwell_ms: dwell,
      ...baseParams,
    });
    viewTimers.delete(key);
  };
}

export function flushSession(reason = 'flush') {
  updateActiveTime();
  trackEvent('app_session_end', {
    active_ms: activeMs,
    total_ms: totalMs(),
    context: reason,
    visibility_state: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
  });
  flushQueue();
}

const ensureGtagScript = () => {
  if (!measurementId || typeof document === 'undefined') return;
  if (document.getElementById(GA_SCRIPT_ID)) {
    scriptLoaded = true;
    return;
  }
  const script = document.createElement('script');
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.onload = () => {
    scriptLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      anonymize_ip: true,
      send_page_view: false,
    });
    flushQueue();
  };
  document.head.appendChild(script);
};

const startHeartbeat = () => {
  if (heartbeatTimer) return;
  heartbeatTimer = window.setInterval(() => {
    updateActiveTime();
    trackEvent('app_heartbeat', {
      active_ms: activeMs,
      total_ms: totalMs(),
      visibility_state: document.visibilityState,
    });
  }, HEARTBEAT_MS);
};

const stopHeartbeat = () => {
  if (!heartbeatTimer) return;
  window.clearInterval(heartbeatTimer);
  heartbeatTimer = null;
};

export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  measurementId = String(import.meta.env.VITE_GA4_MEASUREMENT_ID || '').trim();
  analyticsEnabled = Boolean(measurementId);
  getUserPseudoId();
  getSessionId();
  getSessionStart();

  if (!analyticsEnabled) return;

  ensureGtagScript();
  trackEvent('app_session_start', {
    active_ms: 0,
    total_ms: 0,
    visibility_state: document.visibilityState,
  });
  startHeartbeat();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      updateActiveTime();
      trackEvent('app_heartbeat', {
        active_ms: activeMs,
        total_ms: totalMs(),
        visibility_state: 'hidden',
      });
      flushQueue();
    } else {
      activeStartTs = now();
    }
  });

  window.addEventListener('pagehide', () => {
    flushSession('pagehide');
    stopHeartbeat();
  });
}

