import { expect, test } from '@playwright/test';

test('the cursor stays centered and the screen remains silent after waiting and typing', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto('/installation');
  await expect(page.locator('.cursor')).toHaveCount(1);
  await expect(page.locator('input, textarea, button, aside, .thought')).toHaveCount(0);
  const cursor = await page.locator('.cursor').boundingBox();
  const viewport = page.viewportSize()!;
  expect(Math.abs(cursor!.x + cursor!.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(cursor!.y + cursor!.height / 2 - viewport.height / 2)).toBeLessThan(2);
  await page.clock.runFor(240000);
  await page.keyboard.type('tere');
  await page.keyboard.press('Enter');
  await expect(page.locator('.crt-content')).toHaveText('KIRJUTAMATA');
  await expect(page.locator('.cursor')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: `test-results/${testInfo.project.name}-cursor.png`, scale: 'css' });
  expect(errors).toEqual([]);
});

test('reduced motion keeps a steady cursor', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/installation');
  await expect(page.locator('.cursor')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.cursor')).toHaveCSS('opacity', '1');
});
