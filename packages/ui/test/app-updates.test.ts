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
const details = () => page.getByRole('dialog', { name: 'Pitchcrew update', exact: true });
const inspectUpdate = async () => {
  await action().click();
  await details().waitFor();
  return details();
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
const action = () => page.locator('.app-update-button');
/** Updates use one icon target in the app bar, independent of sidebar collapse. */
const expectCompactIndicator = async () => {
  const bounds = (await action().boundingBox())!;
  expect(bounds.width).toBeLessThanOrEqual(44);
  expect(bounds.height).toBeGreaterThanOrEqual(32);
  if (page.viewportSize()!.width >= 768) {
    const settings = (await page
      .getByRole('link', { name: 'Settings', exact: true })
      .boundingBox())!;
    expect(settings.y + settings.height / 2).toBeCloseTo(bounds.y + bounds.height / 2, 0);
    expect(bounds.y).toBeLessThan(40);
  } else {
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
};

beforeAll(async () => {
  host = await setup(false, { dev: false });
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

test.each([false, true])(
  'Settings shows one current-version status before and after a manual check (native: %s)',
  async (desktop) => {
    const message = 'You are running the latest published version.';
    info = {
      ...available,
      current: { ...available.current, version: '0.17.0' },
      latest: { ...available.latest!, commit: available.current.commit!, version: '0.17.0' },
      status: 'current',
      checkedAt: '2026-11-02T08:51:53Z',
      message,
    };
    await page.addInitScript(() => localStorage.setItem('pitchcrew-automatic-updates-v1', 'false'));
    if (desktop) {
      await page.addInitScript(
        (initial) => {
          (window as unknown as FixtureWindow).pitchcrewUpdates = {
            getState: async () => initial,
            check: async () => initial,
            download: async () => initial,
            install: async () => initial,
            subscribe: () => () => {},
          };
        },
        {
          ...native,
          currentVersion: '0.17.0',
          status: 'current',
          availableVersion: null,
          checkedAt: info.checkedAt,
          message,
        } satisfies DesktopUpdateState,
      );
    }
    await page.goto(`${host.daemon.url}/settings?section=updates`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByRole('tab', { name: 'Updates', exact: true }).click();
    const section = page.getByRole('region', { name: 'Pitchcrew updates', exact: true });
    const status = section.getByRole('status');
    const check = section.getByRole('button', { name: 'Check for updates', exact: true });
    await expect.poll(() => status.allTextContents()).toEqual([message]);
    expect(await section.textContent()).toContain('Version 0.17.0');
    const checkedAt = await page.evaluate(
      (date) => new Date(date!).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
      info.checkedAt,
    );
    expect(await section.textContent()).toContain(`Last checked ${checkedAt}.`);

    let finishCheck!: () => void;
    const pending = new Promise<void>((resolve) => {
      finishCheck = resolve;
    });
    await page.route('**/api/app-updates/check?manual=true', async (route) => {
      await pending;
      await route.fulfill({ json: info });
    });
    try {
      await check.click();
      await expect.poll(() => status.allTextContents()).toEqual(['Checking for updates…']);
      expect(
        await section.getByRole('button', { name: 'Checking…', exact: true }).isDisabled(),
      ).toBe(true);
      info = { ...info, checkedAt: '2026-11-02T08:52:53Z' };
    } finally {
      finishCheck();
    }
    await expect.poll(() => status.allTextContents()).toEqual([message]);
    const nextCheckedAt = await page.evaluate(
      (date) => new Date(date!).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
      info.checkedAt,
    );
    expect(await section.textContent()).toContain(`Last checked ${nextCheckedAt}.`);
    expect(await check.isEnabled()).toBe(true);

    await page.route('**/api/app-updates/check?manual=true', (route) =>
      route.fulfill({ status: 503, json: { error: 'offline' } }),
    );
    await check.click();
    await expect
      .poll(() => status.allTextContents())
      .toEqual(['Could not reach the local daemon to check for updates.']);
    expect(await check.isEnabled()).toBe(true);
    expect(await section.getByText(message, { exact: true }).count()).toBe(0);
    await page.route('**/api/app-updates/check?manual=true', (route) =>
      route.fulfill({ json: info }),
    );
    await check.click();
    await expect.poll(() => status.allTextContents()).toEqual([message]);
  },
  45000,
);

test('the download icon stops spinning when the native check finishes before the daemon', async () => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  let finishDaemonCheck!: () => void;
  const daemonCheck = new Promise<void>((resolve) => {
    finishDaemonCheck = resolve;
  });
  await page.route('**/api/app-updates', async (route) => {
    await daemonCheck;
    await route.fulfill({ json: { ...info, automatic: false } });
  });
  await page.addInitScript((initial) => {
    const fixture = window as unknown as FixtureWindow;
    let state: DesktopUpdateState = { ...initial, status: 'checking', availableVersion: null };
    let listener: ((value: DesktopUpdateState) => void) | undefined;
    fixture.updateFixture = (patch) => {
      state = { ...state, ...patch };
      listener?.(state);
    };
    fixture.pitchcrewUpdates = {
      getState: async () => state,
      check: async () => state,
      download: async () => state,
      install: async () => state,
      subscribe: (next) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
    };
  }, native);
  try {
    await page.goto(host.daemon.url, { waitUntil: 'domcontentloaded' });
    await page.locator('.workspace-app-bar').waitFor();
    expect(await action().count()).toBe(0);
    await update(native);
    await action().waitFor();
    expect(await action().getAttribute('aria-busy')).toBe('true');
    expect(
      await action()
        .locator('svg')
        .evaluate((icon) => getComputedStyle(icon).animationName),
    ).toBe('none');
  } finally {
    finishDaemonCheck();
  }
  await expect.poll(() => action().getAttribute('aria-busy')).toBe('false');
}, 45000);

test('inspects update details before download, retains the compact target when collapsed and restores dismissal focus', async () => {
  await page.addInitScript(() => {
    window.open = (url) => {
      (window as unknown as FixtureWindow).openedRelease = String(url);
      return null;
    };
  });
  await open();
  await expectCompactIndicator();
  await focusAction();
  await page.keyboard.press('Enter');
  const panel = details();
  await panel.waitFor();
  expect(await panel.textContent()).toContain('Version 0.2.0');
  expect(await panel.locator('li').allTextContents()).toEqual(available.latest!.changes);
  expect(await panel.textContent()).toContain('More changes in release notes');
  expect(
    await page.evaluate(() => (window as unknown as FixtureWindow).openedRelease),
  ).toBeUndefined();
  await panel.getByRole('button', { name: 'Download update', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as FixtureWindow).openedRelease)).toBe(
    available.latest!.url,
  );
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  await expect
    .poll(() => action().evaluate((element) => element === document.activeElement))
    .toBe(true);
  await page.getByRole('button', { name: 'Hide sidebar', exact: true }).click();
  await expectCompactIndicator();
  await page.getByRole('button', { name: 'Show sidebar', exact: true }).click();
  await inspectUpdate();
  await panel.getByRole('button', { name: 'Dismiss update notice' }).click();
  await expect.poll(() => action().count()).toBe(0);
  await expect
    .poll(() =>
      page
        .getByRole('link', { name: 'Settings', exact: true })
        .evaluate((element) => document.activeElement === element),
    )
    .toBe(true);
  // A manual check (command palette or Settings > Updates) restores the dismissed build.
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Search Pitchcrew', exact: true });
  await palette.getByRole('combobox').fill('Check for updates');
  await palette.getByRole('option', { name: /Check for updates/ }).click();
  await action().waitFor();
  expect(await action().getAttribute('aria-label')).toContain('Download update');
}, 45000);

test('native progress stays visible through navigation and restart requires its explicit action', async () => {
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
  await expectCompactIndicator();
  const panel = await inspectUpdate();
  expect(await page.evaluate(() => (window as unknown as FixtureWindow).updateCalls)).toEqual([]);
  await panel.getByRole('button', { name: 'Download update', exact: true }).click();
  await update({ downloadPercent: 42 });
  await panel.getByRole('button', { name: 'Downloading… 42%' }).waitFor();
  expect(await panel.getByRole('button', { name: 'Dismiss update notice' }).isDisabled()).toBe(
    true,
  );
  expect(await panel.getByRole('button', { name: 'Downloading… 42%' }).isDisabled()).toBe(true);
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  expect(await action().getAttribute('aria-label')).toContain('42%');
  expect(await page.locator('.app-update-progress').getAttribute('style')).toContain('42%');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Updates', exact: true }).click();
  await page.getByRole('heading', { name: 'Pitchcrew updates' }).waitFor();
  const status = page
    .getByRole('region', { name: 'Pitchcrew updates', exact: true })
    .getByRole('status');
  expect(await status.allTextContents()).toEqual([native.message]);
  expect(await action().getAttribute('aria-label')).toContain('42%');
  await update({ status: 'error', message: 'Could not download the update. Try again.' });
  await expect
    .poll(() => status.allTextContents())
    .toEqual(['Could not download the update. Try again.']);
  await inspectUpdate();
  expect(await panel.textContent()).toContain('Could not download');
  await panel.getByRole('button', { name: 'Download update', exact: true }).click();
  await update({ status: 'downloaded', downloadedVersion: '0.2.0', downloadPercent: 100 });
  await panel.getByRole('button', { name: 'Restart to update', exact: true }).waitFor();
  await expectCompactIndicator();
  expect(await panel.textContent()).toContain('Restarting interrupts running agents');
  await panel.getByRole('button', { name: 'Restart to update', exact: true }).click();
  await panel.getByRole('button', { name: 'Restarting…', exact: true }).waitFor();
  expect(await page.evaluate(() => (window as unknown as FixtureWindow).updateCalls)).toEqual([
    'download',
    'download',
    'install',
  ]);
}, 45000);

test('mobile retains a compact indicator and older releases have an explicit notes fallback', async () => {
  info = { ...available, latest: { commit: available.latest!.commit, url: available.latest!.url } };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(host.daemon.url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await action().waitFor();
  await expectCompactIndicator();
  const panel = await inspectUpdate();
  expect(await panel.textContent()).toContain('Release notes unavailable.');
  const bounds = (await panel.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(() => (window as unknown as FixtureWindow).openedRelease),
  ).toBeUndefined();
}, 45000);
