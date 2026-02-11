import { expect, test } from '@playwright/test';

test.describe('Avatar Easter Egg', () => {
  test('opens from avatar and closes on Escape', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toHaveClass(/is-loaded/);

    const avatarTrigger = page.locator('.avatar-box');
    await expect(avatarTrigger).toBeVisible();
    await page.waitForTimeout(400);
    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
    await expect(avatarTrigger).toHaveClass(/egg-avatar-trigger/);
    await avatarTrigger.click();

    const overlay = page.locator('.egg-overlay');
    const modal = page.locator('.egg-modal');
    await expect(overlay).toHaveClass(/is-open/);
    await expect(modal).toHaveClass(/is-open/);
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/is-open/);
    await expect(overlay).not.toHaveClass(/is-open/);

    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  });
});
