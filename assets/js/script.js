'use strict';

const STORAGE_KEYS = {
  forceReducedMotion: 'kb_force_reduced_motion',
  effectsIntensity: 'kb_effects_intensity',
  analyticsOptOut: 'kb_analytics_opt_out'
};

const EVENTS = {
  effectsSettings: 'kb-effects-settings',
  virtualPageView: 'kb:virtual-pageview'
};

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getCurrentPath() {
  const { pathname, hash } = window.location;
  return `${pathname}${hash || ''}`;
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
    publishEffectsSettings(readStoredEffectsSettings());
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
  }

  syncIntensityLabel(settings.intensity);
  publishEffectsSettings(settings);

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
    publishEffectsSettings(readStoredEffectsSettings());
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

  if (doNotTrackEnabled || localStorage.getItem(STORAGE_KEYS.analyticsOptOut) === '1') {
    return;
  }

  const pixelMeta = document.querySelector('meta[name="privacy-analytics-pixel"]');
  const pixelPath = pixelMeta?.getAttribute('content')?.trim();
  if (!pixelPath) {
    return;
  }

  let lastTrackedPath = '';

  function trackPageView(path) {
    const normalizedPath = (path || getCurrentPath()).trim();
    if (!normalizedPath || normalizedPath === lastTrackedPath) {
      return;
    }
    lastTrackedPath = normalizedPath;

    const params = new URLSearchParams({
      v: '1',
      event: 'pageview',
      path: normalizedPath,
      ts: String(Date.now())
    });

    if (document.referrer) {
      params.set('ref', document.referrer.slice(0, 300));
    }

    const queryPrefix = pixelPath.includes('?') ? '&' : '?';
    const image = new Image(1, 1);
    image.referrerPolicy = 'no-referrer';
    image.src = `${pixelPath}${queryPrefix}${params.toString()}`;
  }

  window.addEventListener('hashchange', () => trackPageView(getCurrentPath()));
  window.addEventListener(EVENTS.virtualPageView, (event) => {
    const customEvent = /** @type {CustomEvent} */ (event);
    trackPageView(customEvent.detail?.path);
  });

  trackPageView(getCurrentPath());
}

async function initializePage() {
  document.body.classList.add('is-loaded');

  initEffectPreferences();
  initPrivacyAnalytics();
  initTabs();
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
  bootstrapPage();
  document.addEventListener('DOMContentLoaded', bootstrapPage, { once: true });
} else {
  bootstrapPage();
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

  function activatePage(targetKey, shouldScroll = true) {
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
        detail: { path: `${window.location.pathname}#${targetKey}` }
      })
    );
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const target = link.dataset.target;
      if (target && pageMap.has(target)) {
        activatePage(target, true);
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
    activatePage(targetFromHash, false);
    return;
  }

  const initial = navLinks.find((link) => link.classList.contains('active'));
  if (initial?.dataset.target && pageMap.has(initial.dataset.target)) {
    activatePage(initial.dataset.target, false);
  }
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

  function createProjectItem(project) {
    const title = String(project.title || 'Untitled Project').trim();
    const categories = normalizeFilterList(project.filters);
    const previewUrl = String(project.previewUrl || '#').trim();
    const previewDomain = String(project.previewDomain || '').trim();
    const previewAriaLabel = String(project.previewAriaLabel || `Open ${title} website`).trim();
    const categoryLabel = String(project.categoryLabel || 'Project').trim();
    const description = String(project.description || '').trim();
    const repoUrl = String(project.repoUrl || '#').trim();
    const repoLabel = String(project.repoLabel || 'View GitHub Repo').trim();
    const primaryActionLabel = String(project.primaryActionLabel || 'Open Live Website').trim();
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

    const image = document.createElement('img');
    image.src = String(imageConfig.src || '').trim();
    image.alt = String(imageConfig.alt || `${title} preview`).trim();
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

    const actions = document.createElement('div');
    actions.className = 'project-actions';

    const primaryAction = document.createElement('a');
    primaryAction.className = 'project-action project-action-primary';
    primaryAction.href = previewUrl;
    primaryAction.target = '_blank';
    primaryAction.rel = 'noopener noreferrer';
    primaryAction.textContent = primaryActionLabel;

    const repoAction = document.createElement('a');
    repoAction.className = 'project-action';
    repoAction.href = repoUrl;
    repoAction.target = '_blank';
    repoAction.rel = 'noopener noreferrer';
    repoAction.textContent = repoLabel;

    actions.append(primaryAction, repoAction);
    content.append(titleNode, categoryNode, descriptionNode, actions);

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
    title.textContent = 'Project data unavailable';

    const description = document.createElement('p');
    description.className = 'project-description';
    description.textContent =
      'Please refresh the page. If the issue persists, check assets/data/projects.json.';

    content.append(title, description);
    article.append(content);
    listItem.append(article);
    projectList.append(listItem);
  }

  try {
    const response = await fetch(source, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load project data (${response.status})`);
    }

    const payload = await response.json();
    const projects = Array.isArray(payload?.projects) ? payload.projects : [];
    if (!projects.length) {
      throw new Error('Project data file does not contain projects.');
    }

    projectList.innerHTML = '';
    projects.forEach((project) => {
      projectList.append(createProjectItem(project));
    });
  } catch (error) {
    console.error(error);
    renderErrorState();
  } finally {
    projectList.setAttribute('aria-busy', 'false');
  }
}

function initProjectFilters() {
  const filterButtons = Array.from(document.querySelectorAll('[data-filter-btn]'));
  const filterItems = Array.from(document.querySelectorAll('[data-filter-item]'));
  const selectBox = document.querySelector('.filter-select-box');
  const selectTrigger = document.querySelector('[data-select]');
  const selectValue = document.querySelector('[data-select-value]');
  const selectItems = Array.from(document.querySelectorAll('[data-select-item]'));

  if (!filterItems.length) {
    return;
  }

  const labelByFilter = {
    all: 'All',
    security: 'Security',
    automation: 'Automation'
  };

  function applyFilter(filter) {
    const normalized = (filter || 'all').toLowerCase();

    filterItems.forEach((item) => {
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
      selectValue.textContent = labelByFilter[normalized] || 'All';
    }
  }

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyFilter(button.dataset.filter);
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
        applyFilter(item.dataset.filter);
        closeSelect();
      });
    });
  }

  applyFilter('all');
}
