import { expect, test, type Page } from '@playwright/test';

async function enableInteraction(page: Page) {
  const toggle = page.getByRole('switch', { name: 'Interactive mode' });
  await toggle.click();
  await expect(toggle).toBeChecked();
  await page.locator('.jelly-stage canvas').click({ position: { x: 2, y: 2 } });
}

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-certificate-errors'],
  },
});

test('the large switch changes between a moving display and direct interaction', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.goto('/');
  await expect(page.locator('.jelly-stage')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  const toggle = page.getByRole('switch', { name: 'Interactive mode' });
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText('floppy mode on', { exact: true })).toBeVisible();
  const size = await toggle.boundingBox();
  expect(size!.height).toBeGreaterThanOrEqual(60);
  const initial = await page.evaluate(() => window.blueWhale!.state());
  await expect.poll(async () => (await page.evaluate(() => window.blueWhale!.state())).centerHeight, { timeout: 30000 }).toBeGreaterThan(initial.centerHeight + .30);
  const display = await page.evaluate(() => window.blueWhale!.state());
  expect(display.interactive).toBe(false);
  expect(display.hops).toBeGreaterThan(0);
  expect(Math.abs(display.cameraAzimuth - initial.cameraAzimuth)).toBeGreaterThan(.01);
  expect(await page.evaluate(async () => {await document.fonts.ready;return document.fonts.check('40px "Rubik Bubbles"');})).toBe(true);
  const label = await page.locator('.mode-label').boundingBox();
  expect(label!.x).toBeGreaterThanOrEqual(8);
  expect(label!.x + label!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 8);
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width * .45, viewport.height * .5);
  await page.mouse.down();
  expect((await page.evaluate(() => window.blueWhale!.state())).grabbed).toBe(false);
  await page.mouse.up();
  await page.screenshot({ path: `test-results/whale-display-${testInfo.project.name}.png` });
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).toBeChecked();
  await expect(page.getByText('jiggly mode on', { exact: true })).toBeVisible();
  const enabled = await page.evaluate(() => window.blueWhale!.state());
  expect(enabled.interactive).toBe(true);
  const angle = enabled.cameraAzimuth;
  await expect.poll(async () => (await page.evaluate(() => window.blueWhale!.state())).time, { timeout: 30000 }).toBeGreaterThan(enabled.time + .35);
  const after = await page.evaluate(() => window.blueWhale!.state());
  expect(after.hops).toBe(enabled.hops);
  expect(after.cameraAzimuth).toBeCloseTo(angle, 3);
  await page.mouse.move(viewport.width * .45, viewport.height * .5);
  await page.mouse.down();
  expect((await page.evaluate(() => window.blueWhale!.state())).grabbed).toBe(true);
  // Switching by keyboard must also cancel a grab that still owns capture.
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).not.toBeChecked();
  expect((await page.evaluate(() => window.blueWhale!.state())).grabbed).toBe(false);
  await page.mouse.up();
});

test('the whale fills a white canvas with one mode switch and responds to its shortcuts', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.locator('.jelly-stage')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  await enableInteraction(page);
  await expect(page.getByRole('switch', { name: 'Interactive mode' })).toBeChecked();
  await expect(page.locator('button')).toHaveCount(1);
  await expect(page.locator('input, aside, header, h1')).toHaveCount(0);
  const initial = await page.evaluate(() => window.blueWhale!.state());
  expect(initial.renderer).toBe('170');
  expect(initial.nodes).toBeGreaterThan(1000);
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
  await enableInteraction(page);
  const initial = await page.evaluate(() => window.blueWhale!.state());
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width * .35, viewport.height * .52);
  await page.mouse.down();
  expect((await page.evaluate(() => window.blueWhale!.state())).grabbed).toBe(true);
  await page.mouse.move(viewport.width * .55, viewport.height * .28, { steps: 12 });
  // A successful raycast alone does not mean the pointer actually pulls the body.
  await expect.poll(async () => (await page.evaluate(() => window.blueWhale!.state())).deformation, { timeout: 15000 }).toBeGreaterThan(.6);
  await page.screenshot({ path: `test-results/whale-pull-${testInfo.project.name}.png` });
  await page.mouse.up();
  const released = await page.evaluate(() => window.blueWhale!.state());
  expect(released.grabbed).toBe(false);
  await expect.poll(async () => (await page.evaluate(() => window.blueWhale!.state())).time, { timeout: 45000 }).toBeGreaterThan(released.time + 2);
  const settled = await page.evaluate(() => window.blueWhale!.state());
  expect(settled.volume / initial.volume).toBeGreaterThan(.98);
  expect(settled.volume / initial.volume).toBeLessThan(1.02);
  await page.screenshot({ path: `test-results/whale-release-${testInfo.project.name}.png` });
  await page.keyboard.press('r');
  await page.mouse.move(viewport.width * .4, viewport.height * .43);
  await page.mouse.down();
  expect((await page.evaluate(() => window.blueWhale!.state())).grabbed).toBe(true);
  // Scale the press with the whale's screen width, so phone portrait height
  // does not turn the same gesture into a much deeper floor collision.
  await page.mouse.move(viewport.width * .44, viewport.height * .43 + viewport.width * .14, { steps: 12 });
  await expect.poll(async () => (await page.evaluate(() => window.blueWhale!.state())).deformation, { timeout: 15000 }).toBeGreaterThan(.35);
  await page.screenshot({ path: `test-results/whale-squash-${testInfo.project.name}.png` });
  await page.mouse.up();
  const squashed = await page.evaluate(() => window.blueWhale!.state());
  expect(squashed.grabbed).toBe(false);
  // Allow five simulation seconds to settle; software WebGL on phones can
  // advance simulation much more slowly than wall time.
  await expect.poll(async () => (await page.evaluate(() => window.blueWhale!.state())).time, { timeout: 60000 }).toBeGreaterThan(squashed.time + 5);
  expect((await page.evaluate(() => window.blueWhale!.state())).volume / initial.volume).toBeGreaterThan(.98);
  expect(errors).toEqual([]);
});

test('production resolves Three r170 through the import map', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('.jelly-stage')).toHaveAttribute('data-ready', 'true', { timeout: 45000 });
  expect((await page.evaluate(() => window.blueWhale!.state())).renderer).toBe('170');
  await expect(page.getByRole('switch', { name: 'Interactive mode' })).not.toBeChecked();
  await expect(page.getByText('floppy mode on', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('touch can pull the whale when reduced motion starts it paused', async ({ page, context }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.jelly-stage')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  await enableInteraction(page);
  expect((await page.evaluate(() => window.blueWhale!.state())).paused).toBe(true);
  const viewport = page.viewportSize()!;
  const touch = await context.newCDPSession(page);
  const x = viewport.width * .35, y = viewport.height * .52;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  expect((await page.evaluate(() => window.blueWhale!.state())).grabbed).toBe(true);
  for (let i = 1; i <= 8; i++) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + viewport.width * .16 * i / 8, y: y - viewport.height * .2 * i / 8 }] });
  }
  await expect.poll(async () => (await page.evaluate(() => window.blueWhale!.state())).deformation, { timeout: 15000 }).toBeGreaterThan(.6);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect((await page.evaluate(() => window.blueWhale!.state())).grabbed).toBe(false);
  await touch.detach();
});

test('a blocked rendering CDN still shows a whale without text', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.whale-fallback')).toBeVisible();
  await expect(page.locator('body')).toHaveText('');
});
