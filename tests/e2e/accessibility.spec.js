import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Accessibility Checks', () => {
  const routes = ['/', '/#resume', '/#portfolio'];

  for (const route of routes) {
    test(`has no serious or critical axe violations on ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('body')).toHaveClass(/is-loaded/);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['landmark-one-main'])
        .analyze();

      const severeViolations = results.violations.filter((violation) => {
        return violation.impact === 'serious' || violation.impact === 'critical';
      });

      expect(
        severeViolations,
        severeViolations
          .map((violation) => `${violation.id}: ${violation.help} (${violation.impact})`)
          .join('\n')
      ).toEqual([]);
    });
  }
});
