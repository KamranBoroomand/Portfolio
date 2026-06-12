'use strict';

const STORAGE_KEYS = {
  forceReducedMotion: 'kb_force_reduced_motion',
  effectsIntensity: 'kb_effects_intensity',
  analyticsOptOut: 'kb_analytics_opt_out',
  language: 'kb_language'
};

const EVENTS = {
  effectsSettings: 'kb-effects-settings',
  virtualPageView: 'kb:virtual-pageview',
  languageChanged: 'kb:language-changed'
};

const SUPPORTED_LANGUAGES = ['en', 'ru', 'fa'];
const DEFAULT_LANGUAGE = 'en';
const I18N_SOURCE = './assets/data/translations.json';
const EFFECTS_BUNDLE_SOURCE = './assets/js/effects.bundle.js';
const LIGHTHOUSE_QUERY_PARAM = 'lhci';
const ANALYTICS_EVENT_ALLOWLIST = new Set(
  'pageview outbound_click tab_open project_filter_change project_open_live_preview project_open_live project_open_repo project_case_study contact_email contact_telegram contact_github references_commits references_live_verification lead_form_start lead_form_invalid lead_mailto_open lead_calendar resume_download portfolio_more_repos monitoring_public_metric monitoring_alerts cta_resume_download cta_email cta_telegram cta_github client_error'.split(
    ' '
  )
);
const ANALYTICS_CAMPAIGN_FIELDS = 'utm_source utm_medium utm_campaign utm_content'.split(' ');
const ANALYTICS_DROPPED_QUERY_FIELDS = 'gclid fbclid msclkid ttclid'.split(' ');
const ANALYTICS_TARGET_ALLOWLIST = new Set(
  'mailto tel telegram github project_live project_repo resume_download calendar internal'.split(
    ' '
  )
);

let TRANSLATIONS = Object.freeze({ [DEFAULT_LANGUAGE]: {} });
let hasLoadedTranslations = false;
let hasLoadedEffectsBundle = false;

let currentLanguage = DEFAULT_LANGUAGE;
let cachedProjects = [];
let renderProjectsForCurrentLanguage = null;
let activeProjectFilter = 'all';
let applyProjectFilterRef = null;
let refreshProjectFilterLabelsRef = null;

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isLighthouseUserAgent() {
  return /Chrome-Lighthouse/i.test(navigator.userAgent);
}

function isAuditMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get(LIGHTHOUSE_QUERY_PARAM) === '1' || isLighthouseUserAgent();
}

function getCurrentPath() {
  return `${location.pathname}${location.search}${location.hash}`;
}

function sanitizeAnalyticsValue(value, maxLength = 180) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function emitAnalyticsEvent(eventName, payload = {}) {
  const tracker = window.__KB_ANALYTICS_TRACK__;
  if (typeof tracker === 'function') {
    tracker(eventName, payload);
  }
}

function hasAnalyticsOptedOut() {
  try {
    return localStorage.getItem(STORAGE_KEYS.analyticsOptOut) === '1';
  } catch {
    return true;
  }
}

function sanitizeAnalyticsToken(value, maxLength = 80) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9 ._:-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeAnalyticsEventName(eventName) {
  const event = sanitizeAnalyticsToken(eventName, 48);
  return ANALYTICS_EVENT_ALLOWLIST.has(event) ? event : '';
}

function sanitizeAnalyticsPath(value = getCurrentPath()) {
  let url;
  try {
    url = new URL(String(value || getCurrentPath()), `${location.origin}/`);
  } catch {
    url = new URL('/', location.origin);
  }

  const campaigns = {};
  for (const field of ANALYTICS_CAMPAIGN_FIELDS) {
    const rawValue = url.searchParams.get(field);
    if (!rawValue) {
      continue;
    }

    const maxLength = field === 'utm_content' ? 60 : 80;
    const safeValue = sanitizeAnalyticsToken(rawValue, maxLength);
    if (safeValue && (field !== 'utm_content' || rawValue.length <= 80)) {
      campaigns[field] = safeValue;
    }
  }

  for (const field of ANALYTICS_DROPPED_QUERY_FIELDS) {
    url.searchParams.delete(field);
  }

  const pathOnly = `${url.pathname}${url.hash}`;
  return {
    path: sanitizeAnalyticsValue(pathOnly || '/', 200),
    campaigns
  };
}

function categorizeAnalyticsTarget(href, eventName = '') {
  const event = sanitizeAnalyticsEventName(eventName) || sanitizeAnalyticsToken(eventName, 48);
  const rawTarget = String(href || '').trim();
  const normalizedTarget = sanitizeAnalyticsToken(rawTarget, 80);

  if (ANALYTICS_TARGET_ALLOWLIST.has(normalizedTarget)) {
    return normalizedTarget;
  }

  if (event.includes('mailto') || event.includes('email')) {
    return 'mailto';
  }

  if (event.includes('telegram')) {
    return 'telegram';
  }

  if (event.includes('resume')) {
    return 'resume_download';
  }

  if (event.includes('repo')) {
    return 'project_repo';
  }

  if (event.includes('github') || event === 'references_commits') {
    return 'github';
  }

  if (event.includes('live') || event.includes('preview')) {
    return 'project_live';
  }

  if (event.includes('calendar')) {
    return 'calendar';
  }

  try {
    const resolvedUrl = new URL(rawTarget, location.origin);
    if (resolvedUrl.protocol === 'mailto:') {
      return 'mailto';
    }

    if (resolvedUrl.protocol === 'tel:') {
      return 'tel';
    }

    const host = resolvedUrl.hostname.toLowerCase();
    if (host === 'github.com') {
      return event.includes('repo') || event.startsWith('case_') ? 'project_repo' : 'github';
    }

    if (host === 't.me' || host.endsWith('.t.me')) {
      return 'telegram';
    }

    if (host === 'calendar.google.com') {
      return 'calendar';
    }

    if (resolvedUrl.pathname.endsWith('.pdf')) {
      return 'resume_download';
    }

    if (host.endsWith('kamranboroomand.ir') && resolvedUrl.origin !== location.origin) {
      return 'project_live';
    }

    if (resolvedUrl.origin === location.origin) {
      return 'internal';
    }
  } catch {
    return '';
  }

  return '';
}

function normalizeLanguage(language) {
  language = String(language || '')
    .trim()
    .toLowerCase();
  return SUPPORTED_LANGUAGES.includes(language) ? language : null;
}

async function ensureTranslationsLoaded() {
  if (hasLoadedTranslations) {
    return;
  }

  try {
    const response = await fetch(I18N_SOURCE);
    if (!response.ok) {
      throw new Error(`Failed to load translations (${response.status})`);
    }

    const payload = await response.json();
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      TRANSLATIONS = payload;
      hasLoadedTranslations = true;
      return;
    }
  } catch (error) {
    console.error(error);
  }

  hasLoadedTranslations = true;
}

function getTranslation(locale, key) {
  return TRANSLATIONS[locale]?.[key] || TRANSLATIONS[DEFAULT_LANGUAGE]?.[key] || '';
}

function formatTemplate(template, values) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, name) => {
    return Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : '';
  });
}

function applyTextTranslations(locale) {
  const elements = Array.from(document.querySelectorAll('[data-i18n]'));
  elements.forEach((element) => {
    const key = element.dataset.i18n;
    if (!key) {
      return;
    }
    const value = getTranslation(locale, key);
    if (value) {
      element.textContent = value;
    }
  });
}

function applyAttributeTranslations(locale) {
  const elements = Array.from(document.querySelectorAll('[data-i18n-attr]'));
  elements.forEach((element) => {
    const definitions = String(element.dataset.i18nAttr || '')
      .split(';')
      .map((definition) => definition.trim())
      .filter(Boolean);

    definitions.forEach((definition) => {
      const separatorIndex = definition.indexOf(':');
      if (separatorIndex <= 0) {
        return;
      }

      const attributeName = definition.slice(0, separatorIndex).trim();
      const key = definition.slice(separatorIndex + 1).trim();
      if (!attributeName || !key) {
        return;
      }

      const value = getTranslation(locale, key);
      if (value) {
        element.setAttribute(attributeName, value);
      }
    });
  });
}

function setDocumentLanguage(locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr';
  document.body.dataset.lang = locale;
}

function updateLanguageInUrl(locale) {
  const url = new URL(window.location.href);
  if (locale === DEFAULT_LANGUAGE) {
    url.searchParams.delete('lang');
  } else {
    url.searchParams.set('lang', locale);
  }

  const nextPath = `${url.pathname}${url.search}${url.hash}`;
  if (nextPath !== getCurrentPath()) {
    history.replaceState(null, '', nextPath);
  }
}

function syncLanguageSelectControl(locale) {
  const select = document.querySelector('[data-language-select]');
  if (select instanceof HTMLSelectElement) {
    select.value = locale;
  }
}

function applyLanguage(locale, options = {}) {
  const { persist = true, updateUrl = true, reRenderProjects = true } = options;
  const normalized = normalizeLanguage(locale) || DEFAULT_LANGUAGE;
  currentLanguage = normalized;

  if (persist) {
    localStorage.setItem(STORAGE_KEYS.language, normalized);
  }

  if (updateUrl) {
    updateLanguageInUrl(normalized);
  }

  setDocumentLanguage(normalized);
  applyTextTranslations(normalized);
  applyAttributeTranslations(normalized);
  syncLanguageSelectControl(normalized);

  if (reRenderProjects && typeof renderProjectsForCurrentLanguage === 'function') {
    renderProjectsForCurrentLanguage();
  }

  if (typeof refreshProjectFilterLabelsRef === 'function') {
    refreshProjectFilterLabelsRef();
  }

  if (typeof applyProjectFilterRef === 'function') {
    applyProjectFilterRef(activeProjectFilter);
  }

  window.dispatchEvent(
    new CustomEvent(EVENTS.languageChanged, {
      detail: { language: normalized }
    })
  );
}

function getInitialLanguage() {
  const fromUrl = normalizeLanguage(new URLSearchParams(window.location.search).get('lang'));
  if (fromUrl) {
    return fromUrl;
  }

  const fromStorage = normalizeLanguage(localStorage.getItem(STORAGE_KEYS.language));
  return fromStorage || DEFAULT_LANGUAGE;
}

function initLanguageControls() {
  const select = document.querySelector('[data-language-select]');
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  select.value = currentLanguage;
  select.addEventListener('change', () => {
    applyLanguage(select.value, { persist: true, updateUrl: true, reRenderProjects: true });
  });
}

function readStoredEffectsSettings() {
  const rawReducedMotion = localStorage.getItem(STORAGE_KEYS.forceReducedMotion);
  const rawIntensity = localStorage.getItem(STORAGE_KEYS.effectsIntensity);
  const intensity = clampNumber(Number.parseFloat(rawIntensity || '1') || 1, 0, 1);

  return {
    forceReducedMotion: rawReducedMotion === '1',
    intensity
  };
}

function resolveEffectiveMotionPreference(forceReducedMotion) {
  const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return forceReducedMotion || systemReducedMotion;
}

function shouldRenderEffects(settings) {
  return (
    !isAuditMode() &&
    !resolveEffectiveMotionPreference(settings.forceReducedMotion) &&
    settings.intensity > 0.05
  );
}

function scheduleIdleTask(task) {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(task, { timeout: 1500 });
    return;
  }
  window.setTimeout(task, 350);
}

function ensureEffectsBundleLoaded(settings = readStoredEffectsSettings()) {
  if (hasLoadedEffectsBundle || !shouldRenderEffects(settings)) {
    return;
  }

  hasLoadedEffectsBundle = true;
  scheduleIdleTask(() => {
    const existingScript = document.querySelector('script[data-effects-bundle="1"]');
    if (existingScript) {
      return;
    }

    const script = document.createElement('script');
    script.src = EFFECTS_BUNDLE_SOURCE;
    script.async = true;
    script.dataset.effectsBundle = '1';
    script.addEventListener('error', () => {
      hasLoadedEffectsBundle = false;
    });
    document.body.append(script);
  });
}

function publishEffectsSettings(settings) {
  const detail = {
    reducedMotion: resolveEffectiveMotionPreference(settings.forceReducedMotion),
    intensity: settings.intensity
  };

  document.body.classList.toggle('motion-reduce-forced', settings.forceReducedMotion);
  document.documentElement.style.setProperty('--effects-intensity', String(settings.intensity));
  window.__KB_EFFECTS_SETTINGS__ = detail;
  window.dispatchEvent(new CustomEvent(EVENTS.effectsSettings, { detail }));
}

function initEffectPreferences() {
  const reducedMotionToggle = document.querySelector('[data-preference-reduce-motion]');
  const intensityRange = document.querySelector('[data-preference-effects-intensity]');
  const intensityValue = document.querySelector('[data-effects-value]');

  if (!(reducedMotionToggle instanceof HTMLInputElement)) {
    const settings = readStoredEffectsSettings();
    publishEffectsSettings(settings);
    ensureEffectsBundleLoaded(settings);
    return;
  }

  const settings = readStoredEffectsSettings();
  reducedMotionToggle.checked = settings.forceReducedMotion;

  if (intensityRange instanceof HTMLInputElement) {
    intensityRange.value = String(Math.round(settings.intensity * 100));
  }

  function syncIntensityLabel(intensity) {
    if (intensityValue) {
      intensityValue.textContent = `${Math.round(intensity * 100)}%`;
    }
  }

  function persistAndPublish(nextSettings) {
    localStorage.setItem(
      STORAGE_KEYS.forceReducedMotion,
      nextSettings.forceReducedMotion ? '1' : '0'
    );
    localStorage.setItem(STORAGE_KEYS.effectsIntensity, nextSettings.intensity.toFixed(2));
    syncIntensityLabel(nextSettings.intensity);
    publishEffectsSettings(nextSettings);
    ensureEffectsBundleLoaded(nextSettings);
  }

  syncIntensityLabel(settings.intensity);
  publishEffectsSettings(settings);
  ensureEffectsBundleLoaded(settings);

  reducedMotionToggle.addEventListener('change', () => {
    persistAndPublish({
      ...readStoredEffectsSettings(),
      forceReducedMotion: reducedMotionToggle.checked
    });
  });

  if (intensityRange instanceof HTMLInputElement) {
    intensityRange.addEventListener('input', () => {
      const intensity = clampNumber((Number.parseInt(intensityRange.value, 10) || 100) / 100, 0, 1);
      persistAndPublish({
        ...readStoredEffectsSettings(),
        intensity
      });
    });
  }

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handleSystemMotionChange = () => {
    const latest = readStoredEffectsSettings();
    publishEffectsSettings(latest);
    ensureEffectsBundleLoaded(latest);
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleSystemMotionChange);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handleSystemMotionChange);
  }
}

function initPrivacyAnalytics() {
  const doNotTrackEnabled =
    navigator.doNotTrack === '1' ||
    window.doNotTrack === '1' ||
    navigator.msDoNotTrack === '1' ||
    navigator.globalPrivacyControl === true;

  if (doNotTrackEnabled || hasAnalyticsOptedOut()) {
    return;
  }

  const pixelMeta = document.querySelector('meta[name="privacy-analytics-pixel"]');
  const pixelPath = pixelMeta?.getAttribute('content')?.trim();
  if (!pixelPath) {
    return;
  }

  let lastTrackedPath = '';
  let errorEventsSent = 0;

  function sendPixelRequest(params) {
    if (typeof fetch !== 'function') {
      return;
    }

    const queryPrefix = pixelPath.includes('?') ? '&' : '?';
    const url = `${pixelPath}${queryPrefix}${params.toString()}`;
    const referrerPolicy = 'no-referrer';

    fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      keepalive: true,
      referrerPolicy
    }).catch(() => {});
  }

  function sendAnalyticsEvent(eventName, payload = {}) {
    const event = sanitizeAnalyticsEventName(eventName);
    if (!event) {
      return;
    }

    const sanitizedPath = sanitizeAnalyticsPath(payload.path || getCurrentPath());
    const params = new URLSearchParams({
      v: '1',
      event,
      path: sanitizedPath.path,
      ts: String(Date.now()),
      lang: currentLanguage
    });

    for (const [field, value] of Object.entries(sanitizedPath.campaigns)) {
      params.set(field, value);
    }

    const label = sanitizeAnalyticsToken(payload.label, 80);
    if (label) {
      params.set('label', label);
    }

    const target = categorizeAnalyticsTarget(payload.target, event);
    if (target) {
      params.set('target', target);
    }

    sendPixelRequest(params);
  }

  window.__KB_ANALYTICS_TRACK__ = sendAnalyticsEvent;

  function trackPageView(path) {
    const normalizedPath = sanitizeAnalyticsPath(path || getCurrentPath()).path;
    if (!normalizedPath || normalizedPath === lastTrackedPath) {
      return;
    }

    lastTrackedPath = normalizedPath;
    sendAnalyticsEvent('pageview', { path: normalizedPath });
  }

  function trackClientError() {
    if (errorEventsSent >= 8) {
      return;
    }

    errorEventsSent += 1;
    sendAnalyticsEvent('client_error');
  }

  document.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const link = event.target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      const href = link.getAttribute('href');
      if (!href) {
        return;
      }

      const explicitEvent = sanitizeAnalyticsEventName(link.dataset.trackEvent);
      const label = sanitizeAnalyticsToken(link.dataset.trackLabel, 80);

      let targetCategory = categorizeAnalyticsTarget(href, explicitEvent);
      let isOutbound = false;

      try {
        const resolvedUrl = new URL(href, location.origin);
        isOutbound =
          resolvedUrl.origin !== location.origin ||
          resolvedUrl.protocol === 'mailto:' ||
          resolvedUrl.protocol === 'tel:';
      } catch {
        targetCategory = categorizeAnalyticsTarget(href, explicitEvent);
      }

      if (explicitEvent) {
        sendAnalyticsEvent(explicitEvent, {
          path: getCurrentPath(),
          label,
          target: targetCategory
        });
        return;
      }

      if (isOutbound) {
        sendAnalyticsEvent('outbound_click', {
          path: getCurrentPath(),
          label: targetCategory,
          target: targetCategory
        });
      }
    },
    { capture: true }
  );

  window.addEventListener('error', () => trackClientError());
  window.addEventListener('unhandledrejection', () => trackClientError());

  window.addEventListener('hashchange', () => trackPageView(getCurrentPath()));
  window.addEventListener(EVENTS.virtualPageView, (event) => {
    const customEvent = /** @type {CustomEvent} */ (event);
    trackPageView(customEvent.detail?.path);
  });
  window.addEventListener(EVENTS.languageChanged, () => {
    trackPageView(getCurrentPath());
  });

  trackPageView(getCurrentPath());
}

function initPrivacyAnalyticsControl() {
  const toggle = document.querySelector('[data-analytics-opt-toggle]');
  const status = document.querySelector('[data-analytics-status]');
  if (!(toggle instanceof HTMLButtonElement)) {
    return;
  }

  function readPreference() {
    try {
      return localStorage.getItem(STORAGE_KEYS.analyticsOptOut) === '1';
    } catch {
      return true;
    }
  }

  function writePreference(isOptedOut) {
    try {
      if (isOptedOut) {
        localStorage.setItem(STORAGE_KEYS.analyticsOptOut, '1');
      } else {
        localStorage.removeItem(STORAGE_KEYS.analyticsOptOut);
      }
      return true;
    } catch {
      return false;
    }
  }

  function render() {
    const optedOut = readPreference();
    toggle.textContent = optedOut ? 'Allow analytics' : 'Opt out analytics';
    toggle.setAttribute('aria-pressed', String(optedOut));

    if (status) {
      status.textContent = optedOut
        ? 'Analytics is off in this browser.'
        : 'First-party only. No ad pixels or third-party analytics.';
    }
  }

  toggle.addEventListener('click', () => {
    const nextOptOut = !readPreference();
    if (writePreference(nextOptOut)) {
      render();
    } else if (status) {
      status.textContent = 'Analytics is off because local storage is unavailable.';
    }
  });

  render();
}

function initCredibilityPanel() {
  const lastShipNode = document.querySelector('[data-proof-last-ship]');
  const activityNode = document.querySelector('[data-proof-activity]');
  if (!lastShipNode && !activityNode) {
    return;
  }

  function renderCredibility() {
    if (lastShipNode) {
      lastShipNode.textContent = getTranslation(currentLanguage, 'proof.lastShipFallback');
    }

    if (activityNode) {
      activityNode.textContent = getTranslation(currentLanguage, 'proof.activityFallback');
    }
  }

  renderCredibility();
  window.addEventListener(EVENTS.languageChanged, renderCredibility);
}

function initLeadFunnel() {
  const form = document.querySelector('[data-lead-form]');
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const statusNode = form.querySelector('[data-lead-status]');
  const recipient = 'kamranboroomand@mail.ru';
  let hasTrackedLeadStart = false;

  function trackLeadStart() {
    if (hasTrackedLeadStart) {
      return;
    }

    hasTrackedLeadStart = true;
    emitAnalyticsEvent('lead_form_start', { path: getCurrentPath() });
  }

  function setStatus(statusKey) {
    form.dataset.statusKey = statusKey;
    if (statusNode) {
      statusNode.textContent = getTranslation(currentLanguage, statusKey);
    }
  }

  function syncStatus() {
    const statusKey = form.dataset.statusKey || 'intake.noteDefault';
    if (statusNode) {
      statusNode.textContent = getTranslation(currentLanguage, statusKey);
    }
  }

  form.addEventListener('focusin', trackLeadStart);

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      emitAnalyticsEvent('lead_form_invalid', { path: getCurrentPath() });
      setStatus('intake.noteInvalid');
      return;
    }

    const formData = new FormData(form);
    const honeypotValue = String(formData.get('company_website') || '').trim();
    if (honeypotValue) {
      form.reset();
      setStatus('intake.noteDefault');
      return;
    }

    const name = sanitizeAnalyticsValue(formData.get('name'), 80);
    const email = sanitizeAnalyticsValue(formData.get('email'), 120);
    const projectType = sanitizeAnalyticsValue(formData.get('projectType'), 80);
    const timeline = sanitizeAnalyticsValue(formData.get('timeline'), 80);
    const summary = sanitizeAnalyticsValue(formData.get('summary'), 700);

    if (!name || !email || !projectType || !timeline || !summary) {
      emitAnalyticsEvent('lead_form_invalid', { path: getCurrentPath() });
      setStatus('intake.noteInvalid');
      return;
    }

    const subject = `[Portfolio Inquiry] ${projectType} - ${name}`;
    const sourcePath = sanitizeAnalyticsPath(getCurrentPath()).path;
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Project Type: ${projectType}`,
      `Timeline: ${timeline}`,
      '',
      'Project Summary:',
      summary,
      '',
      `Source: ${sourcePath}`
    ].join('\n');

    const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const tempLink = document.createElement('a');
    tempLink.href = mailtoUrl;
    tempLink.style.display = 'none';
    form.append(tempLink);
    tempLink.click();
    tempLink.remove();

    emitAnalyticsEvent('lead_mailto_open', {
      path: getCurrentPath(),
      label: 'intake',
      target: 'mailto'
    });

    form.reset();
    setStatus('intake.noteSent');
  });

  window.addEventListener(EVENTS.languageChanged, syncStatus);
  setStatus('intake.noteDefault');
}

function initTabs() {
  const navLinks = Array.from(document.querySelectorAll('[data-nav-link]'));
  const pages = Array.from(document.querySelectorAll('[data-page]'));

  if (!navLinks.length || !pages.length) {
    return;
  }

  const pageMap = new Map();
  pages.forEach((page) => {
    const key = page.dataset.page;
    if (key) {
      pageMap.set(key, page);
    }
  });

  function activatePage(targetKey, shouldScroll = true, shouldTrack = true) {
    navLinks.forEach((link) => {
      const isActive = link.dataset.target === targetKey;
      link.classList.toggle('active', isActive);
      link.setAttribute('aria-selected', String(isActive));
      link.tabIndex = isActive ? 0 : -1;
    });

    pages.forEach((page) => {
      const isActive = page.dataset.page === targetKey;
      page.classList.toggle('active', isActive);
      page.setAttribute('aria-hidden', String(!isActive));
      page.hidden = !isActive;
    });

    if (shouldScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (window.location.hash !== `#${targetKey}`) {
      history.replaceState(null, '', `#${targetKey}`);
    }

    window.dispatchEvent(
      new CustomEvent(EVENTS.virtualPageView, {
        detail: { path: `${window.location.pathname}${window.location.search}#${targetKey}` }
      })
    );

    if (shouldTrack) {
      emitAnalyticsEvent('tab_open', {
        path: getCurrentPath(),
        label: targetKey
      });
    }
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const target = link.dataset.target;
      if (target && pageMap.has(target)) {
        activatePage(target, true, true);
      }
    });
  });

  navLinks.forEach((link, index) => {
    link.addEventListener('keydown', (event) => {
      const { key } = event;
      const lastIndex = navLinks.length - 1;
      let nextIndex;

      if (key === 'ArrowRight') {
        nextIndex = index === lastIndex ? 0 : index + 1;
      } else if (key === 'ArrowLeft') {
        nextIndex = index === 0 ? lastIndex : index - 1;
      } else if (key === 'Home') {
        nextIndex = 0;
      } else if (key === 'End') {
        nextIndex = lastIndex;
      } else if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        link.click();
        return;
      } else {
        return;
      }

      event.preventDefault();
      navLinks[nextIndex].focus();
      navLinks[nextIndex].click();
    });
  });

  const targetFromHash = window.location.hash.replace('#', '').trim().toLowerCase();
  if (targetFromHash && pageMap.has(targetFromHash)) {
    activatePage(targetFromHash, false, false);
    return;
  }

  const initial = navLinks.find((link) => link.classList.contains('active'));
  if (initial?.dataset.target && pageMap.has(initial.dataset.target)) {
    activatePage(initial.dataset.target, false, false);
  }
}

function getLocalizedProjectField(project, locale, fieldKey, fallback) {
  const localePack = project?.i18n?.[locale];
  const localizedValue = localePack && typeof localePack === 'object' ? localePack[fieldKey] : null;
  if (typeof localizedValue === 'string' && localizedValue.trim()) {
    return localizedValue.trim();
  }

  const baseValue = project?.[fieldKey];
  if (typeof baseValue === 'string' && baseValue.trim()) {
    return baseValue.trim();
  }

  return String(fallback || '').trim();
}

function getLocalizedProjectArray(project, locale, fieldKey) {
  const localePack = project?.i18n?.[locale];
  const localizedValue = localePack && typeof localePack === 'object' ? localePack[fieldKey] : null;
  if (Array.isArray(localizedValue)) {
    return localizedValue;
  }

  return Array.isArray(project?.[fieldKey]) ? project[fieldKey] : [];
}

async function initProjects() {
  const projectList = document.querySelector('[data-project-list]');
  if (!(projectList instanceof HTMLUListElement)) {
    return;
  }

  const source = projectList.dataset.projectSource || './assets/data/projects.json';
  projectList.setAttribute('aria-busy', 'true');

  function normalizeFilter(filter) {
    return String(filter || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
  }

  function normalizeFilterList(filters) {
    const normalized = Array.isArray(filters)
      ? filters.map(normalizeFilter).filter(Boolean)
      : ['all'];
    return normalized.length ? Array.from(new Set(normalized)) : ['all'];
  }

  function buildResponsiveSrcSet(baseName, widths, extension) {
    if (!baseName || !Array.isArray(widths) || !widths.length) {
      return '';
    }

    const safeWidths = widths
      .map((width) => Number.parseInt(String(width), 10))
      .filter((width) => Number.isFinite(width) && width > 0);

    return safeWidths
      .map((width) => `./assets/images/responsive/${baseName}-${width}.${extension} ${width}w`)
      .join(', ');
  }

  function isPrivateRepoUrl(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    return (
      !normalized ||
      normalized === '#' ||
      normalized === 'private' ||
      normalized === 'private-source' ||
      normalized === 'private source'
    );
  }

  function createProjectItem(project, locale) {
    const title = getLocalizedProjectField(
      project,
      locale,
      'title',
      getTranslation(locale, 'projects.untitled')
    );
    const categories = normalizeFilterList(project.filters);
    const previewUrl = String(project.previewUrl || '#').trim();
    const previewDomain = String(project.previewDomain || '').trim();
    const previewAriaLabel = getLocalizedProjectField(
      project,
      locale,
      'previewAriaLabel',
      formatTemplate(getTranslation(locale, 'projects.openWebsiteTemplate'), { title })
    );
    const categoryLabel = getLocalizedProjectField(
      project,
      locale,
      'categoryLabel',
      getTranslation(locale, 'projects.defaultCategory')
    );
    const description = getLocalizedProjectField(project, locale, 'description', '');
    const repoUrl = String(project.repoUrl || '#').trim();
    const repoIsPrivate = project?.repoPrivate === true || isPrivateRepoUrl(repoUrl);
    const repoLabel = getLocalizedProjectField(
      project,
      locale,
      'repoLabel',
      repoIsPrivate
        ? getTranslation(locale, 'projects.privateSource')
        : getTranslation(locale, 'projects.viewRepo')
    );
    const primaryActionLabel = getLocalizedProjectField(
      project,
      locale,
      'primaryActionLabel',
      getTranslation(locale, 'projects.openLive')
    );
    const caseStudyLabel = getTranslation(locale, 'projects.caseStudy');
    const caseStudyUrl = String(
      project.caseStudyUrl || (project.id ? `/projects/${project.id}/` : '#')
    ).trim();
    const caseStudyAriaLabel = getLocalizedProjectField(
      project,
      locale,
      'detailAriaLabel',
      formatTemplate(getTranslation(locale, 'projects.caseStudyTemplate'), { title })
    );
    const impactMetrics = getLocalizedProjectArray(project, locale, 'impactMetrics')
      .filter((metric) => metric && typeof metric === 'object')
      .map((metric) => ({
        value: sanitizeAnalyticsValue(metric.value, 40),
        label: sanitizeAnalyticsValue(metric.label, 120)
      }))
      .filter((metric) => metric.value && metric.label)
      .slice(0, 3);

    const imageConfig = project.image && typeof project.image === 'object' ? project.image : {};

    const listItem = document.createElement('li');
    listItem.className = 'project-item active';
    listItem.dataset.filterItem = '';
    listItem.dataset.category = categories.join(',');

    const article = document.createElement('article');
    article.className = 'project-card';

    const previewLink = document.createElement('a');
    previewLink.className = 'project-preview-link';
    previewLink.href = previewUrl;
    previewLink.target = '_blank';
    previewLink.rel = 'noopener noreferrer';
    previewLink.setAttribute('aria-label', previewAriaLabel);
    previewLink.dataset.trackEvent = 'project_open_live_preview';
    previewLink.dataset.trackLabel = title;

    const figure = document.createElement('figure');
    figure.className = 'project-img';

    const previewChrome = document.createElement('div');
    previewChrome.className = 'preview-chrome';
    previewChrome.setAttribute('aria-hidden', 'true');

    const previewDots = document.createElement('span');
    previewDots.className = 'preview-dots';
    previewDots.innerHTML = '<i></i><i></i><i></i>';

    const previewDomainNode = document.createElement('span');
    previewDomainNode.className = 'preview-domain';
    previewDomainNode.textContent = previewDomain;

    previewChrome.append(previewDots, previewDomainNode);

    const picture = document.createElement('picture');
    const responsiveBase = String(imageConfig.responsiveBase || '').trim();
    const responsiveWidths = Array.isArray(imageConfig.responsiveWidths)
      ? imageConfig.responsiveWidths
      : [];
    const imageSizes = String(imageConfig.sizes || '(max-width: 759px) 100vw, 50vw').trim();

    const avifSrcSet = buildResponsiveSrcSet(responsiveBase, responsiveWidths, 'avif');
    if (avifSrcSet) {
      const avifSource = document.createElement('source');
      avifSource.type = 'image/avif';
      avifSource.srcset = avifSrcSet;
      avifSource.sizes = imageSizes;
      picture.append(avifSource);
    }

    const webpSrcSet = buildResponsiveSrcSet(responsiveBase, responsiveWidths, 'webp');
    if (webpSrcSet) {
      const webpSource = document.createElement('source');
      webpSource.type = 'image/webp';
      webpSource.srcset = webpSrcSet;
      webpSource.sizes = imageSizes;
      picture.append(webpSource);
    }

    const localizedImageAlt =
      (project?.i18n?.[locale] && String(project.i18n[locale].imageAlt || '').trim()) ||
      String(imageConfig.alt || `${title} preview`).trim();

    const image = document.createElement('img');
    image.src = String(imageConfig.src || '').trim();
    image.alt = localizedImageAlt;
    image.width = Number.parseInt(String(imageConfig.width || 1200), 10) || 1200;
    image.height = Number.parseInt(String(imageConfig.height || 800), 10) || 800;
    image.loading = 'lazy';
    image.decoding = 'async';
    picture.append(image);

    figure.append(previewChrome, picture);
    previewLink.append(figure);

    const content = document.createElement('div');
    content.className = 'project-content';

    const titleNode = document.createElement('h3');
    titleNode.className = 'project-title';
    titleNode.textContent = title;

    const categoryNode = document.createElement('p');
    categoryNode.className = 'project-category';
    categoryNode.textContent = categoryLabel;

    const descriptionNode = document.createElement('p');
    descriptionNode.className = 'project-description';
    descriptionNode.textContent = description;

    content.append(titleNode, categoryNode, descriptionNode);

    if (impactMetrics.length) {
      const metricsTitle = document.createElement('p');
      metricsTitle.className = 'project-metrics-title';
      metricsTitle.textContent = getTranslation(locale, 'projects.impactHeading');

      const metricsList = document.createElement('ul');
      metricsList.className = 'project-metrics';
      metricsList.setAttribute('aria-label', getTranslation(locale, 'projects.metricsAria'));

      impactMetrics.forEach((metric) => {
        const item = document.createElement('li');
        item.className = 'project-metric-item';

        const valueNode = document.createElement('span');
        valueNode.className = 'project-metric-value';
        valueNode.textContent = metric.value;

        const labelNode = document.createElement('p');
        labelNode.className = 'project-metric-label';
        labelNode.textContent = metric.label;

        item.append(valueNode, labelNode);
        metricsList.append(item);
      });

      content.append(metricsTitle, metricsList);
    }

    const actions = document.createElement('div');
    actions.className = 'project-actions';

    const primaryAction = document.createElement('a');
    primaryAction.className = 'project-action project-action-primary';
    primaryAction.href = previewUrl;
    primaryAction.target = '_blank';
    primaryAction.rel = 'noopener noreferrer';
    primaryAction.textContent = primaryActionLabel;
    primaryAction.dataset.trackEvent = 'project_open_live';
    primaryAction.dataset.trackLabel = title;

    actions.append(primaryAction);

    if (repoIsPrivate) {
      const repoAction = document.createElement('span');
      repoAction.className = 'project-action project-action-muted';
      repoAction.textContent = repoLabel;
      repoAction.setAttribute('aria-disabled', 'true');
      actions.append(repoAction);
    } else {
      const repoAction = document.createElement('a');
      repoAction.className = 'project-action';
      repoAction.href = repoUrl;
      repoAction.target = '_blank';
      repoAction.rel = 'noopener noreferrer';
      repoAction.textContent = repoLabel;
      repoAction.dataset.trackEvent = 'project_open_repo';
      repoAction.dataset.trackLabel = title;
      actions.append(repoAction);
    }

    if (caseStudyUrl && caseStudyUrl !== '#') {
      const caseStudyAction = document.createElement('a');
      caseStudyAction.className = 'project-action project-action-secondary';
      caseStudyAction.href = caseStudyUrl;
      caseStudyAction.textContent = caseStudyLabel;
      caseStudyAction.setAttribute('aria-label', caseStudyAriaLabel);
      caseStudyAction.dataset.trackEvent = 'project_case_study';
      caseStudyAction.dataset.trackLabel = title;
      actions.append(caseStudyAction);
    }

    content.append(actions);

    article.append(previewLink, content);
    listItem.append(article);
    return listItem;
  }

  function renderErrorState() {
    projectList.innerHTML = '';
    const listItem = document.createElement('li');
    listItem.className = 'project-item active';
    listItem.dataset.filterItem = '';
    listItem.dataset.category = 'all';

    const article = document.createElement('article');
    article.className = 'project-card';

    const content = document.createElement('div');
    content.className = 'project-content';

    const title = document.createElement('h3');
    title.className = 'project-title';
    title.textContent = getTranslation(currentLanguage, 'projects.errorTitle');

    const description = document.createElement('p');
    description.className = 'project-description';
    description.textContent = getTranslation(currentLanguage, 'projects.errorDescription');

    content.append(title, description);
    article.append(content);
    listItem.append(article);
    projectList.append(listItem);
  }

  function renderProjects(projects) {
    projectList.innerHTML = '';
    projects.forEach((project) => {
      projectList.append(createProjectItem(project, currentLanguage));
    });
  }

  renderProjectsForCurrentLanguage = () => {
    if (!cachedProjects.length) {
      return;
    }
    renderProjects(cachedProjects);
  };

  try {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to load project data (${response.status})`);
    }

    const payload = await response.json();
    const projects = Array.isArray(payload?.projects) ? payload.projects : [];
    if (!projects.length) {
      throw new Error('Project data file does not contain projects.');
    }

    cachedProjects = projects;
    renderProjects(cachedProjects);
  } catch (error) {
    console.error(error);
    renderErrorState();
  } finally {
    projectList.setAttribute('aria-busy', 'false');
  }
}

function initProjectFilters() {
  const filterButtons = Array.from(document.querySelectorAll('[data-filter-btn]'));
  const selectBox = document.querySelector('.filter-select-box');
  const selectTrigger = document.querySelector('[data-select]');
  const selectValue = document.querySelector('[data-select-value]');
  const selectItems = Array.from(document.querySelectorAll('[data-select-item]'));

  if (!filterButtons.length) {
    return;
  }

  function getFilterItems() {
    return Array.from(document.querySelectorAll('[data-filter-item]'));
  }

  function getFilterLabel(filter) {
    return (
      getTranslation(currentLanguage, `filters.${filter}`) ||
      getTranslation(currentLanguage, 'filters.all')
    );
  }

  function applyFilter(filter, { trackEvent = false } = {}) {
    const normalized = (filter || 'all').toLowerCase();
    activeProjectFilter = normalized;

    getFilterItems().forEach((item) => {
      const categories = (item.dataset.category || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);

      const isVisible = normalized === 'all' || categories.includes(normalized);
      item.classList.toggle('active', isVisible);
      item.hidden = !isVisible;
    });

    filterButtons.forEach((button) => {
      const isActive = button.dataset.filter === normalized;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });

    selectItems.forEach((item) => {
      const isActive = item.dataset.filter === normalized;
      item.setAttribute('aria-selected', String(isActive));
    });

    if (selectValue) {
      selectValue.textContent = getFilterLabel(normalized);
    }

    if (trackEvent) {
      emitAnalyticsEvent('project_filter_change', {
        path: getCurrentPath(),
        label: normalized
      });
    }
  }

  function refreshLabels() {
    if (selectValue) {
      selectValue.textContent = getFilterLabel(activeProjectFilter);
    }
  }

  applyProjectFilterRef = applyFilter;
  refreshProjectFilterLabelsRef = refreshLabels;

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyFilter(button.dataset.filter, { trackEvent: true });
    });
  });

  filterButtons.forEach((button, index) => {
    button.addEventListener('keydown', (event) => {
      const { key } = event;
      const lastIndex = filterButtons.length - 1;
      let nextIndex;

      if (key === 'ArrowRight') {
        nextIndex = index === lastIndex ? 0 : index + 1;
      } else if (key === 'ArrowLeft') {
        nextIndex = index === 0 ? lastIndex : index - 1;
      } else if (key === 'Home') {
        nextIndex = 0;
      } else if (key === 'End') {
        nextIndex = lastIndex;
      } else if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        button.click();
        return;
      } else {
        return;
      }

      event.preventDefault();
      filterButtons[nextIndex].focus();
      filterButtons[nextIndex].click();
    });
  });

  function closeSelect() {
    if (selectBox && selectTrigger) {
      selectBox.classList.remove('active');
      selectTrigger.setAttribute('aria-expanded', 'false');
    }
  }

  if (selectBox && selectTrigger) {
    selectTrigger.addEventListener('click', () => {
      const next = !selectBox.classList.contains('active');
      selectBox.classList.toggle('active', next);
      selectTrigger.setAttribute('aria-expanded', String(next));
    });

    document.addEventListener('click', (event) => {
      if (!selectBox.contains(event.target)) {
        closeSelect();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeSelect();
      }
    });

    selectItems.forEach((item) => {
      item.addEventListener('click', () => {
        applyFilter(item.dataset.filter, { trackEvent: true });
        closeSelect();
      });
    });
  }

  applyFilter(activeProjectFilter);
}

async function initializePage() {
  await ensureTranslationsLoaded();
  const initialLanguage = getInitialLanguage();
  applyLanguage(initialLanguage, { persist: false, updateUrl: true, reRenderProjects: false });

  document.body.classList.add('is-loaded');

  initLanguageControls();
  initTabs();
  initEffectPreferences();
  initPrivacyAnalyticsControl();
  initPrivacyAnalytics();
  initCredibilityPanel();
  initLeadFunnel();
  await initProjects();
  initProjectFilters();
}

let hasInitialized = false;

function bootstrapPage() {
  if (hasInitialized) {
    return;
  }
  hasInitialized = true;
  void initializePage();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapPage, { once: true });
} else {
  bootstrapPage();
}
