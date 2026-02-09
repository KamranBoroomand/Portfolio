"use strict";

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("is-loaded");

  initTabs();
  initProjectFilters();
});

function initTabs() {
  const navLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
  const pages = Array.from(document.querySelectorAll("[data-page]"));
  const quickLinks = Array.from(document.querySelectorAll("[data-open-page]"));

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
      link.classList.toggle("active", isActive);
      link.setAttribute("aria-selected", String(isActive));
      link.tabIndex = isActive ? 0 : -1;
    });

    pages.forEach((page) => {
      const isActive = page.dataset.page === targetKey;
      page.classList.toggle("active", isActive);
      page.setAttribute("aria-hidden", String(!isActive));
      page.hidden = !isActive;
    });

    if (shouldScroll) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (window.location.hash !== `#${targetKey}`) {
      history.replaceState(null, "", `#${targetKey}`);
    }
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const target = link.dataset.target;
      if (target && pageMap.has(target)) {
        activatePage(target, true);
      }
    });
  });

  quickLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const target = link.dataset.openPage;
      if (target && pageMap.has(target)) {
        activatePage(target, true);
      }
    });
  });

  const targetFromHash = window.location.hash.replace("#", "").trim().toLowerCase();
  if (targetFromHash && pageMap.has(targetFromHash)) {
    activatePage(targetFromHash, false);
    return;
  }

  const initial = navLinks.find((link) => link.classList.contains("active"));
  if (initial?.dataset.target && pageMap.has(initial.dataset.target)) {
    activatePage(initial.dataset.target, false);
  }
}

function initProjectFilters() {
  const filterButtons = Array.from(document.querySelectorAll("[data-filter-btn]"));
  const filterItems = Array.from(document.querySelectorAll("[data-filter-item]"));
  const selectBox = document.querySelector(".filter-select-box");
  const selectTrigger = document.querySelector("[data-select]");
  const selectValue = document.querySelector("[data-select-value]");
  const selectItems = Array.from(document.querySelectorAll("[data-select-item]"));

  if (!filterItems.length) {
    return;
  }

  const labelByFilter = {
    all: "All",
    security: "Security",
    automation: "Automation"
  };

  function applyFilter(filter) {
    const normalized = (filter || "all").toLowerCase();

    filterItems.forEach((item) => {
      const categories = (item.dataset.category || "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);

      const isVisible = normalized === "all" || categories.includes(normalized);
      item.classList.toggle("active", isVisible);
      item.hidden = !isVisible;
    });

    filterButtons.forEach((button) => {
      const isActive = button.dataset.filter === normalized;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    selectItems.forEach((item) => {
      const isActive = item.dataset.filter === normalized;
      item.setAttribute("aria-selected", String(isActive));
    });

    if (selectValue) {
      selectValue.textContent = labelByFilter[normalized] || "All";
    }
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyFilter(button.dataset.filter);
    });
  });

  function closeSelect() {
    if (selectBox && selectTrigger) {
      selectBox.classList.remove("active");
      selectTrigger.setAttribute("aria-expanded", "false");
    }
  }

  if (selectBox && selectTrigger) {
    selectTrigger.addEventListener("click", () => {
      const next = !selectBox.classList.contains("active");
      selectBox.classList.toggle("active", next);
      selectTrigger.setAttribute("aria-expanded", String(next));
    });

    document.addEventListener("click", (event) => {
      if (!selectBox.contains(event.target)) {
        closeSelect();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSelect();
      }
    });

    selectItems.forEach((item) => {
      item.addEventListener("click", () => {
        applyFilter(item.dataset.filter);
        closeSelect();
      });
    });
  }

  applyFilter("all");
}
