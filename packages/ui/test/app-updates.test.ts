import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import type { AppUpdateInfo, DesktopUpdateBridge, DesktopUpdateState } from '@pitchcrew/core';
import { cleanup, setup } from './helpers/daemon.ts';
const open = async () => {
  await page.goto(host.daemon.url, { waitUntil: 'domcontentloaded' });
  await action().waitFor({ timeout: 30000 });
};
const focusAction = async () => {
  await page.keyboard.press('Tab');
  await action().focus();
};
const update = async (patch: Partial<DesktopUpdateState>) => {
  await page.evaluate((value) => (window as unknown as FixtureWindow).updateFixture(value), patch);
};

const available: AppUpdateInfo = {
  current: { version: '0.1.0', commit: 'a'.repeat(40), packaged: true },
  automatic: true,
  status: 'available',
  checkedAt: '2026-10-20T00:00:00Z',
  latest: {
    commit: 'b'.repeat(40),
    url: 'https://github.com/HitBox38/PitchCrew/releases/tag/build-' + 'b'.repeat(40),
    version: '0.2.0',
    changes: ['Inline update actions', 'Keyboard focus improvements', 'Clearer download progress'],
    moreChanges: true,
  },
  message: 'A newer Pitchcrew build is available.',
};
const native: DesktopUpdateState = {
  enabled: true,
  currentVersion: '0.1.0',
  status: 'available',
  availableVersion: '0.2.0',
  downloadedVersion: null,
  downloadPercent: null,
  checkedAt: null,
  message: 'Version 0.2.0 is ready to download.',
};
type FixtureWindow = Window & {
  pitchcrewUpdates: DesktopUpdateBridge;
  updateFixture: (patch: Partial<DesktopUpdateState>) => void;
  updateCalls: string[];
  openedRelease: string | null;
};
let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let info: AppUpdateInfo;
const errors: string[] = [];
const action = () =>
  page.locator('[data-slot="sidebar-footer"] [data-slot="sidebar-menu-button"]').filter({
    hasText: /Download update|Restart to update|Downloading|Restarting|Check for updates/,
  });

beforeAll(async () => {
  host = await setup(15749);
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  browser = await chromium.launch({ headless: true });
}, 60000);
beforeEach(async () => {
  info = structuredClone(available);
  errors.length = 0;
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/app-updates**', (route) => route.fulfill({ json: info }));
});
afterEach(async () => {
  await page?.context().close();
  expect(errors).toEqual([]);
});
afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('manual download, changelog tooltip, collapse and session dismissal need no popover', async () => {
  await page.addInitScript(() => {
    window.open = (url) => {
      (window as unknown as FixtureWindow).openedRelease = String(url);
      return null;
    };
  });
  await open();
  const bounds = (await action().boundingBox())!;
  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  expect(bounds.width).toBeGreaterThan(160);
  expect((await settings.boundingBox())!.y).toBeGreaterThanOrEqual(bounds.y + bounds.height);
  await focusAction();
  const tooltip = page.getByRole('tooltip');
  await tooltip.waitFor();
  expect(await tooltip.textContent()).toContain('Version 0.2.0');
  expect(await tooltip.locator('li').allTextContents()).toEqual(available.latest!.changes);
  expect(await tooltip.textContent()).toContain('More changes in release notes');
  expect(await tooltip.locator('a,button').count()).toBe(0);
  await action().click();
  expect(await page.evaluate(() => (window as unknown as FixtureWindow).openedRelease)).toBe(
    available.latest!.url,
  );
  expect(await page.locator('[data-slot="popover-content"]').count()).toBe(0);
  await page.locator('[data-slot="sidebar-trigger"]').click();
  expect((await action().boundingBox())!.width).toBeLessThanOrEqual(40);
  await page.getByRole('button', { name: 'Dismiss update notice' }).click();
  await page.getByRole('button', { name: 'Check for updates', exact: true }).waitFor();
  expect(await action().evaluate((element) => document.activeElement === element)).toBe(true);
  await action().click();
  await action().filter({ hasText: 'Download update' }).waitFor();
  expect(await action().evaluate((element) => document.activeElement === element)).toBe(true);
}, 45000);

test('native download stays visible through navigation and enables restart only after completion', async () => {
  await page.addInitScript((initial) => {
    const fixture = window as unknown as FixtureWindow;
    let state = initial;
    let listener: ((value: DesktopUpdateState) => void) | undefined;
    fixture.updateCalls = [];
    fixture.updateFixture = (patch) => {
      state = { ...state, ...patch };
      listener?.(state);
    };
    fixture.pitchcrewUpdates = {
      getState: async () => state,
      check: async () => state,
      download: async () => {
        fixture.updateCalls.push('download');
        fixture.updateFixture({ status: 'downloading', downloadPercent: 0 });
        return state;
      },
      install: async () => {
        fixture.updateCalls.push('install');
        fixture.updateFixture({ status: 'installing' });
        return state;
      },
      subscribe: (next) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
    };
  }, native);
  await open();
  await action().click();
  await update({ downloadPercent: 42 });
  await page.getByRole('button', { name: 'Downloading… 42%' }).waitFor();
  expect(await page.getByRole('button', { name: 'Dismiss update notice' }).isDisabled()).toBe(true);
  expect(await action().getAttribute('aria-disabled')).toBe('true');
  await focusAction();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as unknown as FixtureWindow).updateCalls)).toEqual([
    'download',
  ]);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Updates', exact: true }).click();
  await page.getByRole('heading', { name: 'Pitchcrew updates' }).waitFor();
  expect(await action().textContent()).toContain('42%');
  expect(await page.locator('.sidebar-update-progress').getAttribute('style')).toContain('42%');
  await update({ status: 'error', message: 'Could not download the update. Try again.' });
  await action().filter({ hasText: 'Download update' }).waitFor();
  await focusAction();
  await page.getByRole('tooltip').waitFor();
  expect(await page.getByRole('tooltip').textContent()).toContain('Could not download');
  await action().click();
  await update({ status: 'downloaded', downloadedVersion: '0.2.0', downloadPercent: 100 });
  await page.getByRole('button', { name: 'Restart to update', exact: true }).waitFor();
  await focusAction();
  expect(await page.getByRole('tooltip').textContent()).toContain(
    'Restarting interrupts running agents',
  );
  await action().click();
  await action().filter({ hasText: 'Restarting…' }).waitFor();
  expect(await page.evaluate(() => (window as unknown as FixtureWindow).updateCalls)).toEqual([
    'download',
    'download',
    'install',
  ]);
}, 45000);

test('mobile keeps the full action and older releases have an explicit notes fallback', async () => {
  info = { ...available, latest: { commit: available.latest!.commit, url: available.latest!.url } };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(host.daemon.url, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-slot="sidebar-trigger"]').click();
  await action().waitFor();
  expect((await action().boundingBox())!.width).toBeGreaterThan(160);
  await focusAction();
  await page.getByRole('tooltip').waitFor();
  expect(await page.getByRole('tooltip').textContent()).toContain('Release notes unavailable.');
  expect(await page.locator('[data-slot="popover-content"]').count()).toBe(0);
}, 45000);
