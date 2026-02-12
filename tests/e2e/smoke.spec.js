import { expect, test } from '@playwright/test';

test.describe('Portfolio Smoke Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Keep smoke tests focused on interaction logic, not heavy visual effects/font network latency.
    await page.route('**/assets/js/effects.bundle.js', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: ''
      });
    });
    await page.route('**/assets/js/effects.bundle.css', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: ''
      });
    });
    await page.route('https://fonts.googleapis.com/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: ''
      });
    });
    await page.route('https://fonts.gstatic.com/**', (route) => {
      route.abort();
    });
  });

  async function applyProjectFilter(page, filterName) {
    const desktopFilterButton = page.locator(`[data-filter-btn][data-filter="${filterName}"]`);
    if (await desktopFilterButton.isVisible()) {
      await desktopFilterButton.click();
      return;
    }

    const mobileSelectTrigger = page.locator('[data-select]');
    await mobileSelectTrigger.click();
    await page.locator(`[data-select-item][data-filter="${filterName}"]`).click();
  }

  test('switches between tabs and syncs URL hash', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('body')).toHaveClass(/is-loaded/);
    await expect(page.locator('.icon-box .ui-icon').first()).toBeVisible();

    const aboutPanel = page.locator('#about-page');
    const resumePanel = page.locator('#resume-page');
    const projectsPanel = page.locator('#portfolio-page');

    await expect(aboutPanel).toBeVisible();
    await expect(page).toHaveURL(/#about$/);

    await page.getByRole('tab', { name: 'Resume' }).click();
    await expect(resumePanel).toBeVisible();
    await expect(page).toHaveURL(/#resume$/);

    await page.getByRole('tab', { name: 'Projects' }).click();
    await expect(projectsPanel).toBeVisible();
    await expect(page).toHaveURL(/#portfolio$/);
  });

  test('toggles language across English, Russian, and Persian', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const languageSelect = page.locator('[data-language-select]');
    await expect(languageSelect).toBeVisible();
    await expect(languageSelect).toHaveValue('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await languageSelect.selectOption('ru');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page).toHaveURL(/\?lang=ru.*#about$/);
    await expect(page.getByRole('tab', { name: 'Обо мне' })).toBeVisible();
    await expect(page.locator('.sidebar-section-title')).toHaveText('Контакты');

    await languageSelect.selectOption('fa');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page).toHaveURL(/\?lang=fa.*#about$/);
    await expect(page.getByRole('tab', { name: 'درباره' })).toBeVisible();
    await expect(page.locator('.sidebar-section-title')).toHaveText('ارتباط');

    await languageSelect.selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page).toHaveURL(/#about$/);
    await expect(page.getByRole('tab', { name: 'About' })).toBeVisible();
  });

  test('applies project filters', async ({ page }) => {
    await page.goto('/#portfolio', { waitUntil: 'domcontentloaded' });

    const projectsTab = page.getByRole('tab', { name: 'Projects' });
    if (!(await projectsTab.getAttribute('aria-selected'))?.includes('true')) {
      await projectsTab.click();
    }

    const visibleProjectItems = page.locator('.project-item:not([hidden])');

    await expect(visibleProjectItems).toHaveCount(3);

    await applyProjectFilter(page, 'security');
    await expect(visibleProjectItems).toHaveCount(1);
    await expect(page.locator('.project-item:not([hidden]) .project-title')).toHaveText(['NullID']);

    await applyProjectFilter(page, 'automation');
    await expect(visibleProjectItems).toHaveCount(1);
    await expect(page.locator('.project-item:not([hidden]) .project-title')).toHaveText([
      'NullCal'
    ]);

    await applyProjectFilter(page, 'all');
    await expect(visibleProjectItems).toHaveCount(3);
  });

  test('links each project to a dedicated case study page', async ({ page }) => {
    await page.goto('/#portfolio', { waitUntil: 'domcontentloaded' });

    const projectsTab = page.getByRole('tab', { name: 'Projects' });
    if (!(await projectsTab.getAttribute('aria-selected'))?.includes('true')) {
      await projectsTab.click();
    }

    const caseStudies = [
      { href: '/projects/nullid/', title: /NullID Case Study/ },
      { href: '/projects/nullcal/', title: /NullCal Case Study/ },
      { href: '/projects/pacman/', title: /PacMan Case Study/ }
    ];

    for (const item of caseStudies) {
      const link = page.locator(`a[href="${item.href}"]`).first();
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(item.href);
      await expect(page).toHaveTitle(item.title);
      await page.goBack();
    }
  });

  test('exposes key outbound links with hardened rel attributes', async ({ page }) => {
    await page.goto('/#portfolio', { waitUntil: 'domcontentloaded' });

    const projectsTab = page.getByRole('tab', { name: 'Projects' });
    if (!(await projectsTab.getAttribute('aria-selected'))?.includes('true')) {
      await projectsTab.click();
    }

    const expectedLinks = [
      'https://nullid.kamranboroomand.ir',
      'https://nullcal.kamranboroomand.ir',
      'https://pacman.kamranboroomand.ir',
      'https://github.com/KamranBoroomand/NullID',
      'https://github.com/KamranBoroomand/NullCal'
    ];

    for (const href of expectedLinks) {
      const link = page.locator(`a[href="${href}"]`).first();
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('target', '_blank');
      const relValue = await link.getAttribute('rel');
      expect(relValue).toContain('noopener');
      expect(relValue).toContain('noreferrer');
    }
  });
});
