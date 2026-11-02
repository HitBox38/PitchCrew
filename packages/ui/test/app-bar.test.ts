import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cleanup, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
const errors: string[] = [];
const shots = resolve('test-results/sidebar-redesign');
let capacity = 10;
let active = 0;

beforeAll(async () => {
  host = await setup(14629);
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  host.daemon.service.board.record(
    'queue_settings',
    { id: 'workspace', concurrency: 10 },
    'user',
    'Layout fixture',
  );
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(error.message));
  // Exercise display scalability independently of the daemon's configured capacity limit.
  await page.route('**/api/snapshot?view=workspace', async (route) => {
    const headers = { ...route.request().headers() };
    delete headers['if-none-match'];
    const response = await route.fetch({ headers });
    const snapshot = await response.json();
    snapshot.queue = { ...snapshot.queue, concurrency: capacity, active };
    await route.fulfill({ json: snapshot });
  });
  await page.goto(host.daemon.url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('banner', { name: 'Workspace controls' }).waitFor({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await mkdir(shots, { recursive: true });
}, 60000);

afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('global controls share the app bar and leave the sidebar free of pinned desktop tools', async () => {
  const bar = page.getByRole('banner', { name: 'Workspace controls' });
  for (const name of ['Hide sidebar', 'Search', 'New', /^Notifications,/, /^Work queue:/]) {
    expect(await bar.getByRole('button', { name, exact: typeof name === 'string' }).count()).toBe(
      1,
    );
  }
  expect(await bar.getByRole('link', { name: 'Settings', exact: true }).count()).toBe(1);
  expect(await page.locator('[data-slot="sidebar-footer"]').count()).toBe(0);
  expect(await page.locator('[data-slot="sidebar-header"]').count()).toBe(0);
  await bar.getByRole('button', { name: 'Hide sidebar', exact: true }).click();
  await bar.getByRole('button', { name: 'Show sidebar', exact: true }).click();
  await bar.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await bar.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New job', exact: false }).waitFor();
  await page.keyboard.press('Escape');
  expect(await bar.locator('.queue-tray-label').textContent()).toContain('0 / 10');
});

test('capacity never grows the indicator or its DOM, across native window layouts', async () => {
  const trigger = page.getByRole('button', { name: /^Work queue:/ });
  const initialWidth = (await trigger.boundingBox())!.width;
  const initialNodes = await trigger.locator('*').count();
  for (const concurrency of [1, 10, 50, 10_000, 1_000_000]) {
    capacity = concurrency;
    active = Math.floor(concurrency / 2);
    await expect
      .poll(() => trigger.getAttribute('aria-label'), { timeout: 5000 })
      .toContain(`${active} of ${concurrency} slots in use`);
    expect((await trigger.boundingBox())!.width).toBe(initialWidth);
    expect(await trigger.locator('*').count()).toBe(initialNodes);
    for (const platform of ['web', 'win32', 'darwin', 'fullscreen']) {
      await page.evaluate((platform) => {
        if (platform === 'web') delete document.documentElement.dataset.desktop;
        else document.documentElement.dataset.desktop = platform === 'win32' ? platform : 'darwin';
        document.documentElement.dataset.fullscreen = String(platform === 'fullscreen');
        document.documentElement.dataset.theme = 'dark';
      }, platform);
      await page.setViewportSize({ width: 768, height: 900 });
      const layout = await page.evaluate(() => {
        const bar = document.querySelector('.workspace-app-bar')!;
        const rect = (selector: string) =>
          document.querySelector(selector)!.getBoundingClientRect().toJSON();
        return {
          bar: bar.getBoundingClientRect().toJSON(),
          tools: rect('.workspace-app-bar-tools'),
          status: rect('.workspace-app-bar-status'),
          sidebar: rect('[data-slot="sidebar-container"]'),
          meter: rect('.workspace-app-bar .queue-capacity-meter'),
          scroll: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          noDrag: getComputedStyle(bar.querySelector('.workspace-app-bar-tools')!).getPropertyValue(
            '-webkit-app-region',
          ),
        };
      });
      expect(layout.bar.height).toBe(40);
      expect(layout.sidebar.top).toBe(layout.bar.bottom);
      expect(layout.sidebar.bottom).toBe(900);
      expect(layout.tools.right + 16).toBeLessThanOrEqual(layout.status.left);
      expect(layout.status.right).toBeLessThanOrEqual(platform === 'win32' ? 620 : 768);
      if (platform === 'darwin') expect(layout.tools.left).toBeGreaterThanOrEqual(80);
      expect(layout.meter.width).toBe(76);
      expect(layout.meter.left).toBeGreaterThanOrEqual(layout.status.left);
      expect(layout.meter.right).toBeLessThanOrEqual(layout.status.right);
      expect(layout.meter.top).toBeGreaterThanOrEqual(layout.bar.top);
      expect(layout.meter.bottom).toBeLessThanOrEqual(layout.bar.bottom);
      expect(layout.scroll).toBeLessThanOrEqual(768);
      expect(layout.height).toBeLessThanOrEqual(900);
      expect(layout.noDrag).toBe('no-drag');
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  capacity = 10;
  active = 0;
  await expect
    .poll(() => trigger.getAttribute('aria-label'), { timeout: 5000 })
    .toContain('0 of 10 slots in use');
  await page.screenshot({ path: resolve(shots, 'desktop.png') });
}, 30000);

test('phones retain a compact summary and exact large totals in the bounded popover', async () => {
  capacity = 1_000_000;
  active = 250_000;
  await page.evaluate(() => {
    delete document.documentElement.dataset.desktop;
    delete document.documentElement.dataset.fullscreen;
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  const queue = page.getByRole('button', { name: /^Work queue:/ });
  await queue.waitFor();
  expect(await page.locator('.workspace-app-bar').count()).toBe(0);
  await expect
    .poll(() => queue.getAttribute('aria-label'), { timeout: 5000 })
    .toContain('250000 of 1000000');
  expect(await queue.locator('.queue-tray-label').textContent()).toContain('250K / 1M');
  expect((await queue.boundingBox())!.height).toBe(44);
  await queue.click();
  const panel = page.getByRole('dialog', { name: 'Work queue', exact: true });
  await panel.waitFor();
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  expect(await panel.locator('.queue-widget-capacity').textContent()).toContain('250000 working');
  expect(await panel.locator('.queue-widget-capacity').textContent()).toContain('750000 free');
  expect(await panel.locator('.queue-capacity-meter > span').getAttribute('style')).toContain(
    '25%',
  );
  const bounds = (await panel.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: resolve(shots, 'mobile.png') });
  await page.keyboard.press('Escape');
  await expect
    .poll(() => queue.evaluate((element) => element === document.activeElement))
    .toBe(true);
  expect(errors).toEqual([]);
});
