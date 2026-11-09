import { expect, test } from '@playwright/test';

test('production shows only the cursor with no remote assets or debug controls', async ({ page }) => {
  const remoteRequests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).hostname !== '127.0.0.1') remoteRequests.push(request.url());
  });
  await page.clock.install();
  await page.goto('http://127.0.0.1:4173/installation?debug=true');
  await page.clock.runFor(240000);
  await expect(page.locator('.cursor')).toHaveCount(1);
  await expect(page.locator('button, aside, input, textarea, audio, video')).toHaveCount(0);
  await expect(page.locator('.crt-content')).toHaveText('KIRJUTAMATA');
  expect(remoteRequests).toEqual([]);
});
