'use strict';

(function initProjectPageAnalytics() {
  const doNotTrackEnabled =
    navigator.doNotTrack === '1' ||
    window.doNotTrack === '1' ||
    navigator.msDoNotTrack === '1' ||
    navigator.globalPrivacyControl === true;

  if (doNotTrackEnabled) {
    return;
  }

  const pixelMeta = document.querySelector('meta[name="privacy-analytics-pixel"]');
  const pixelPath = pixelMeta?.getAttribute('content')?.trim();
  if (!pixelPath) {
    return;
  }

  const queryPrefix = pixelPath.includes('?') ? '&' : '?';
  let errorEventsSent = 0;

  function sanitize(value, limit = 180) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit);
  }

  function sendEvent(eventName, payload = {}) {
    const event = sanitize(eventName, 48);
    if (!event) {
      return;
    }

    const params = new URLSearchParams({
      v: '1',
      event,
      path: sanitize(
        payload.path ||
          `${window.location.pathname}${window.location.search}${window.location.hash}`,
        220
      ),
      ts: String(Date.now()),
      lang: document.documentElement.lang || 'en'
    });

    const label = sanitize(payload.label, 140);
    if (label) {
      params.set('label', label);
    }

    const target = sanitize(payload.target, 220);
    if (target) {
      params.set('target', target);
    }

    if (document.referrer) {
      params.set('ref', sanitize(document.referrer, 240));
    }

    const image = new Image(1, 1);
    image.referrerPolicy = 'no-referrer';
    image.src = `${pixelPath}${queryPrefix}${params.toString()}`;
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

      const explicitEvent = sanitize(link.dataset.trackEvent, 48);
      const label = sanitize(
        link.dataset.trackLabel || link.textContent || link.getAttribute('aria-label'),
        120
      );

      let resolvedTarget;
      let isOutbound = false;

      try {
        const resolvedUrl = new URL(href, window.location.href);
        resolvedTarget = resolvedUrl.href;
        isOutbound =
          resolvedUrl.origin !== window.location.origin ||
          resolvedUrl.protocol === 'mailto:' ||
          resolvedUrl.protocol === 'tel:';
      } catch {
        resolvedTarget = href;
      }

      if (explicitEvent) {
        sendEvent(explicitEvent, { label, target: resolvedTarget });
        return;
      }

      if (isOutbound) {
        sendEvent('outbound_click', { label, target: resolvedTarget });
      }
    },
    { capture: true }
  );

  function trackClientError(eventName, message, source) {
    if (errorEventsSent >= 8) {
      return;
    }
    errorEventsSent += 1;
    sendEvent(eventName, {
      label: sanitize(message, 140),
      target: sanitize(source, 220)
    });
  }

  window.addEventListener('error', (event) => {
    trackClientError(
      'client_error',
      event.message || 'runtime error',
      `${event.filename || 'inline'}:${event.lineno || 0}:${event.colno || 0}`
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : JSON.stringify(reason || 'unhandled rejection');

    trackClientError('unhandled_rejection', message, 'promise');
  });
})();
