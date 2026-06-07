'use strict';

(function initProjectPageAnalytics() {
  const analyticsOptOutKey = 'kb_analytics_opt_out';
  const ANALYTICS_EVENT_ALLOWLIST = new Set([
    'pageview',
    'outbound_click',
    'case_live_site',
    'case_repo',
    'case_resume_download',
    'case_status_metric',
    'case_status_alerts',
    'client_error'
  ]);
  const ANALYTICS_CAMPAIGN_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  const ANALYTICS_DROPPED_QUERY_FIELDS = ['gclid', 'fbclid', 'msclkid', 'ttclid'];
  const ANALYTICS_TARGET_ALLOWLIST = new Set([
    'mailto',
    'tel',
    'telegram',
    'github',
    'project_live',
    'project_repo',
    'resume_download',
    'internal'
  ]);

  const doNotTrackEnabled =
    navigator.doNotTrack === '1' ||
    window.doNotTrack === '1' ||
    navigator.msDoNotTrack === '1' ||
    navigator.globalPrivacyControl === true;

  function hasAnalyticsOptedOut() {
    try {
      return localStorage.getItem(analyticsOptOutKey) === '1';
    } catch {
      return true;
    }
  }

  if (doNotTrackEnabled || hasAnalyticsOptedOut()) {
    return;
  }

  const pixelMeta = document.querySelector('meta[name="privacy-analytics-pixel"]');
  const pixelPath = pixelMeta?.getAttribute('content')?.trim();
  if (!pixelPath) {
    return;
  }

  let errorEventsSent = 0;

  function sanitize(value, limit = 180) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit);
  }

  function sanitizeAnalyticsToken(value, limit = 80) {
    return String(value || '')
      .replace(/[^a-zA-Z0-9 ._:-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit);
  }

  function sanitizeAnalyticsEventName(eventName) {
    const event = sanitizeAnalyticsToken(eventName, 48);
    return ANALYTICS_EVENT_ALLOWLIST.has(event) ? event : '';
  }

  function sanitizeAnalyticsPath(value = `${location.pathname}${location.search}${location.hash}`) {
    let url;
    try {
      url = new URL(String(value || '/'), `${location.origin}/`);
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

    return {
      path: sanitize(`${url.pathname}${url.hash}` || '/', 220),
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

    if (event.includes('resume')) {
      return 'resume_download';
    }

    if (event.includes('repo')) {
      return 'project_repo';
    }

    if (event.includes('live')) {
      return 'project_live';
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
        return 'project_repo';
      }

      if (host === 't.me' || host.endsWith('.t.me')) {
        return 'telegram';
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

  function sendEvent(eventName, payload = {}) {
    const event = sanitizeAnalyticsEventName(eventName);
    if (!event) {
      return;
    }

    const sanitizedPath = sanitizeAnalyticsPath(payload.path);
    const params = new URLSearchParams({
      v: '1',
      event,
      path: sanitizedPath.path,
      ts: String(Date.now()),
      lang: document.documentElement.lang || 'en'
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

  sendEvent('pageview');

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
        sendEvent(explicitEvent, { label, target: targetCategory });
        return;
      }

      if (isOutbound) {
        sendEvent('outbound_click', { label: targetCategory, target: targetCategory });
      }
    },
    { capture: true }
  );

  function trackClientError() {
    if (errorEventsSent >= 8) {
      return;
    }

    errorEventsSent += 1;
    sendEvent('client_error');
  }

  window.addEventListener('error', () => trackClientError());
  window.addEventListener('unhandledrejection', () => trackClientError());
})();
