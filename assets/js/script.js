// ==========================================================
// Kamran Portfolio — Minimal UI Script
// Tabs: About / Resume / Portfolio
// ==========================================================

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // =========================================================
  // 1) Global page fade-in
  // =========================================================
  document.body.classList.add("is-loaded");

  // =========================================================
  // 2) NAVIGATION (About / Resume / Portfolio)
  // =========================================================
  const navLinks = document.querySelectorAll("[data-nav-link]");
  const pages = document.querySelectorAll("[data-page]");

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const target = link.textContent.trim().toLowerCase();

      // Toggle active class on nav
      navLinks.forEach((btn) => btn.classList.remove("active"));
      link.classList.add("active");

      // Toggle active class on pages
      pages.forEach((page) => {
        if (page.dataset.page === target) {
          page.classList.add("active");
        } else {
          page.classList.remove("active");
        }
      });

      // Smooth scroll to top of main content
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // =========================================================
  // 3) PORTFOLIO FILTERING
  // =========================================================
  const filterButtons = document.querySelectorAll("[data-filter-btn]");
  const filterItems = document.querySelectorAll("[data-filter-item]");
  const select = document.querySelector("[data-select]");
  const selectValue = document.querySelector("[data-selecct-value]");
  const selectItems = document.querySelectorAll("[data-select-item]");

  function filterProjects(category) {
    const normalized = category ? category.toLowerCase() : "all";

    filterItems.forEach((item) => {
      const itemCategory = item.dataset.category;

      if (normalized === "all" || normalized === "") {
        item.classList.add("active");
      } else if (itemCategory === normalized) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });
  }

  // Button-based filter (desktop)
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const category = btn.textContent.trim().toLowerCase();

      filterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      filterProjects(category);

      if (selectValue) {
        selectValue.textContent = btn.textContent.trim();
      }
    });
  });

  // Select dropdown filter (mobile)
  if (select) {
    select.addEventListener("click", () => {
      select.classList.toggle("active");
    });

    selectItems.forEach((item) => {
      item.addEventListener("click", () => {
        const category = item.textContent.trim().toLowerCase();

        if (selectValue) {
          selectValue.textContent = item.textContent.trim();
        }

        select.classList.remove("active");
        filterProjects(category);

        // Sync button state with select choice
        filterButtons.forEach((btn) => {
          const match =
            btn.textContent.trim().toLowerCase() === category ||
            (category === "all" &&
              btn.textContent.trim().toLowerCase() === "all");
          btn.classList.toggle("active", match);
        });
      });
    });

    // Close select when clicking outside
    document.addEventListener("click", (event) => {
      if (!select.contains(event.target)) {
        select.classList.remove("active");
      }
    });
  }

  // =========================================================
  // 4) INTERACTIVE BACKGROUND (points reacting to mouse)
  // =========================================================
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let width = window.innerWidth;
  let height = window.innerHeight;

  canvas.width = width;
  canvas.height = height;

  const POINT_COUNT = Math.min(80, Math.floor((width * height) / 25000));
  const points = [];
  const mouse = { x: null, y: null };
  const influenceRadius = 140; // area around cursor that "reacts"

  function createPoints() {
    points.length = 0;
    for (let i = 0; i < POINT_COUNT; i++) {
      points.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        baseSize: 1 + Math.random() * 1.3
      });
    }
  }

  createPoints();

  // Handle mouse movement
  window.addEventListener("mousemove", (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });

  // If mouse leaves window, slowly fade back to neutral
  window.addEventListener("mouseleave", () => {
    mouse.x = null;
    mouse.y = null;
  });

  // Handle resize
  window.addEventListener("resize", () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    createPoints();
  });

  function animate() {
    ctx.clearRect(0, 0, width, height);

    for (const p of points) {
      // Natural drifting
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges softly
      if (p.x < -50) p.x = width + 50;
      if (p.x > width + 50) p.x = -50;
      if (p.y < -50) p.y = height + 50;
      if (p.y > height + 50) p.y = -50;

      let size = p.baseSize;
      let alpha = 0.18;
      let color = `rgba(255, 255, 255, ${alpha})`;

      // React to mouse proximity
      if (mouse.x !== null && mouse.y !== null) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < influenceRadius) {
          const force = (influenceRadius - dist) / influenceRadius;

          // Light push away from the cursor
          p.x += (dx / dist) * force * 4;
          p.y += (dy / dist) * force * 4;

          size = p.baseSize + force * 2.2;
          alpha = 0.3 + force * 0.4;
          color = `rgba(242, 201, 76, ${alpha})`; // yellow glow near cursor
        }
      }

      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }

  animate();
});

