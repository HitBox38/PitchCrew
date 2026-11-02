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
  expect(await bar.locator('.queue-tray-sockets > span').count()).toBe(10);
});

test('all slots fit below native window controls and above the full-height sidebar', async () => {
  for (const concurrency of [10, 50]) {
    host.daemon.service.board.record(
      'queue_settings',
      { id: 'workspace', concurrency },
      'user',
      'Layout fixture',
    );
    await expect
      .poll(() => page.locator('.workspace-app-bar .queue-tray-sockets > span').count(), {
        timeout: 5000,
      })
      .toBe(concurrency);
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
          sockets: Array.from(bar.querySelectorAll('.clay-bead')).map((slot) =>
            slot.getBoundingClientRect().toJSON(),
          ),
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
      for (const slot of layout.sockets) {
        expect(slot.width).toBeGreaterThan(0);
        expect(slot.left).toBeGreaterThanOrEqual(layout.status.left);
        expect(slot.right).toBeLessThanOrEqual(layout.status.right);
        expect(slot.top).toBeGreaterThanOrEqual(layout.bar.top);
        expect(slot.bottom).toBeLessThanOrEqual(layout.bar.bottom);
      }
      expect(layout.scroll).toBeLessThanOrEqual(768);
      expect(layout.height).toBeLessThanOrEqual(900);
      expect(layout.noDrag).toBe('no-drag');
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  host.daemon.service.board.record(
    'queue_settings',
    { id: 'workspace', concurrency: 10 },
    'user',
    'Layout fixture',
  );
  await expect
    .poll(() => page.locator('.workspace-app-bar .queue-tray-sockets > span').count(), {
      timeout: 5000,
    })
    .toBe(10);
  await page.screenshot({ path: resolve(shots, 'desktop.png') });
});

test('phones retain one page bar and reach every slot through the navigation drawer', async () => {
  await page.evaluate(() => {
    delete document.documentElement.dataset.desktop;
    delete document.documentElement.dataset.fullscreen;
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  const queue = page.getByRole('button', { name: /^Work queue:/ });
  await queue.waitFor();
  expect(await page.locator('.workspace-app-bar').count()).toBe(0);
  expect(await queue.locator('.clay-bead').count()).toBe(10);
  await queue.click();
  const panel = page.getByRole('dialog', { name: 'Work queue', exact: true });
  await panel.waitFor();
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  expect(await panel.locator('.clay-bead').count()).toBe(10);
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
