import { expect, test } from '@playwright/test';

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-certificate-errors'],
  },
});

test('the whale fills a white canvas with no visible UI and responds to its shortcuts', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.locator('.jelly-stage')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  await expect(page.locator('body')).toHaveText('');
  await expect(page.locator('button, input, aside, header, h1')).toHaveCount(0);
  const initial = await page.evaluate(() => window.blueWhale!.state());
  expect(initial.renderer).toBe('170');
  expect(initial.nodes).toBeGreaterThan(4000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.keyboard.press('g');
  await expect.poll(async () => (await page.evaluate(() => window.blueWhale!.state())).inflation, { timeout: 45000 }).toBeGreaterThan(.99);
  const gulp = await page.evaluate(() => window.blueWhale!.state());
  expect(gulp.volume / initial.volume).toBeGreaterThan(1.2);
  await page.keyboard.press('l');
  expect((await page.evaluate(() => window.blueWhale!.state())).dark).toBe(true);
  await page.keyboard.press('3');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press(']');
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width * .5, viewport.height * .5);
  await page.mouse.down();
  await page.keyboard.press('r');
  const reset = await page.evaluate(() => window.blueWhale!.state());
  expect(reset.dark).toBe(false);
  expect(reset.grabbed).toBe(false);
  expect(reset.color).toBe('3a8ef0');
  expect(reset.firmness).toBe(1);
  expect(reset.damping).toBe(1.5);
  await page.mouse.up();
  expect(reset.volume).toBeCloseTo(initial.volume, 1);
  await page.keyboard.press('Space');
  expect((await page.evaluate(() => window.blueWhale!.state())).paused).toBe(true);
  await page.screenshot({ path: `test-results/whale-${testInfo.project.name}.png` });
  expect(errors).toEqual([]);
});

test('a firm pointer drag recovers after release without shrinking', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.jelly-stage')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  const initial = await page.evaluate(() => window.blueWhale!.state());
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width * .35, viewport.height * .52);
  await page.mouse.down();
  expect((await page.evaluate(() => window.blueWhale!.state())).grabbed).toBe(true);
  await page.mouse.move(viewport.width * .55, viewport.height * .28, { steps: 12 });
  await page.mouse.up();
  const released = await page.evaluate(() => window.blueWhale!.state());
  expect(released.grabbed).toBe(false);
  await expect.poll(async () => (await page.evaluate(() => window.blueWhale!.state())).time, { timeout: 45000 }).toBeGreaterThan(released.time + 2);
  const settled = await page.evaluate(() => window.blueWhale!.state());
  expect(settled.volume / initial.volume).toBeGreaterThan(.98);
  expect(settled.volume / initial.volume).toBeLessThan(1.02);
  await page.screenshot({ path: `test-results/whale-release-${testInfo.project.name}.png` });
  expect(errors).toEqual([]);
});

test('production resolves Three r170 through the import map', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('.jelly-stage')).toHaveAttribute('data-ready', 'true', { timeout: 45000 });
  expect((await page.evaluate(() => window.blueWhale!.state())).renderer).toBe('170');
  await expect(page.locator('body')).toHaveText('');
  expect(errors).toEqual([]);
});

test('a blocked rendering CDN still shows a whale without text', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.whale-fallback')).toBeVisible();
  await expect(page.locator('body')).toHaveText('');
});
