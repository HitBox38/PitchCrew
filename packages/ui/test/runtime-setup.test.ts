import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { RuntimeAuthState, RuntimeInfo, RuntimeSetupInfo } from '@pitchcrew/core';
import { adapters } from '../../adapters/src/index.ts';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setup, cleanup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let setupInfo: RuntimeSetupInfo;
let auth: RuntimeAuthState;
const codex: RuntimeInfo = {
  id: 'codex',
  available: true,
  version: '1.0.0',
  detail: 'Fictional compatible installation.',
  models: [{ value: 'fixture-model', label: 'Fixture model' }],
  modelSource: 'runtime',
  modelDetail: 'Fixture model catalog',
};
const capture = async (name: string) => {
  if (!process.env.PITCHCREW_RUNTIME_SETUP_EVIDENCE) return;
  const directory = resolve(process.env.PITCHCREW_RUNTIME_SETUP_EVIDENCE);
  await mkdir(directory, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(directory, `${name}.png`) });
};
const dialog = () => page.getByRole('dialog', { name: 'Set up Codex', exact: true });
const open = async () => {
  await page.goto(`${host.daemon.url}/settings?section=runtimes`);
  await page.locator('#runtime-heading').waitFor();
  const row = page.getByRole('article', { name: 'Codex', exact: true });
  if (!(await row.isVisible()))
    await page.getByRole('button', { name: /Add another runtime/ }).click();
  await row.getByRole('button', { name: /^(Manage|Set up) Codex$/ }).click();
  await dialog().getByRole('tab', { name: '1. Installation', exact: true }).click();
  await dialog().getByRole('heading', { name: 'Install and verify', exact: true }).waitFor();
};
beforeAll(async () => {
  host = await setup(false, { dev: false });
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  browser = await chromium.launch({ headless: true });
}, 60000);
beforeEach(async () => {
  const manager = host.daemon.service.runtimeMaintenance;
  manager.authenticationEnabled = false;
  manager.context().runtimes = [structuredClone(codex)];
  manager.context().modelCatalogs.clear();
  manager.clearAuthentication('codex');
  vi.spyOn(adapters.codex, 'listModels').mockResolvedValue(codex.models);
  vi.spyOn(adapters.codex, 'detect').mockResolvedValue(codex);
  setupInfo = {
    id: 'codex',
    configuredPath: null,
    executable: 'C:\\Fixture\\codex.exe',
    realPath: 'C:\\Fixture\\codex.exe',
    source: 'automatic',
    installer: 'fixture',
    canInstall: false,
    installDetail: 'Fictional installation; no OS changes.',
    busyReasons: [],
  };
  auth = {
    runtime: 'codex',
    supported: true,
    id: null,
    stage: 'idle',
    detail: 'Sign in with ChatGPT.',
    startedAt: null,
    expiresAt: null,
    finishedAt: null,
  };
  vi.spyOn(host.daemon.service.runtimeSetup, 'info').mockImplementation(async () =>
    structuredClone(setupInfo),
  );
  vi.spyOn(host.daemon.service.runtimeAuth, 'current').mockImplementation(() =>
    structuredClone(auth),
  );
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
});
afterEach(async () => {
  await page.close();
  vi.restoreAllMocks();
});
afterAll(async () => {
  await browser.close();
  await cleanup();
});

test('executable diagnostics save verified changes and preserve failed or unsaved drafts', async () => {
  const configure = vi
    .spyOn(host.daemon.service.runtimeSetup, 'configure')
    .mockImplementation(async (_id, path) => {
      if (path === 'relative-path') throw new Error('Enter an absolute executable path.');
      setupInfo = {
        ...setupInfo,
        configuredPath: path,
        executable: path ?? 'C:\\Fixture\\codex.exe',
        source: path ? 'custom' : 'automatic',
      };
      return setupInfo;
    });
  await open();
  await dialog().getByRole('button', { name: 'Executable location', exact: true }).click();
  const path = dialog().getByRole('textbox', {
    name: 'Custom executable path (optional)',
    exact: true,
  });
  await path.fill('relative-path');
  await dialog().getByRole('button', { name: 'Save executable path', exact: true }).click();
  await dialog().getByText('Enter an absolute executable path.', { exact: true }).waitFor();
  expect(await path.inputValue()).toBe('relative-path');
  await path.fill('C:\\Fixture\\custom-codex.exe');
  await dialog().getByRole('button', { name: 'Save executable path', exact: true }).click();
  await expect
    .poll(() =>
      dialog().getByRole('button', { name: 'Save executable path', exact: true }).isDisabled(),
    )
    .toBe(true);
  expect(configure).toHaveBeenLastCalledWith('codex', 'C:\\Fixture\\custom-codex.exe');
  await dialog().getByRole('button', { name: 'Clear custom path', exact: true }).click();
  await dialog().getByRole('button', { name: 'Save executable path', exact: true }).click();
  await expect.poll(() => configure.mock.lastCall?.[1]).toBeNull();
  await path.fill('C:\\Fixture\\unsaved.exe');
  await dialog().getByRole('button', { name: 'Close dialog', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  await discard.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect(await path.inputValue()).toBe('C:\\Fixture\\unsaved.exe');
  await capture('v1-executable-draft');
  await page.keyboard.press('Escape');
  await discard.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await dialog().waitFor({ state: 'detached' });
});

test.each(['setup', 'workspace'] as const)(
  'an acknowledged executable save remains saved when the %s refresh fails',
  async (failure) => {
    let saved = false;
    const configure = vi
      .spyOn(host.daemon.service.runtimeSetup, 'configure')
      .mockImplementation(async (_id, path) => {
        setupInfo = { ...setupInfo, configuredPath: path, executable: path, source: 'custom' };
        saved = true;
        return setupInfo;
      });
    const refresh =
      failure === 'setup' ? '**/api/runtimes/codex/setup' : '**/api/snapshot?view=workspace';
    await page.route(refresh, async (route) => {
      if (!saved || route.request().method() !== 'GET') return route.continue();
      return route.fulfill({
        status: 503,
        json: { error: 'Fixture follow-up refresh unavailable.' },
      });
    });
    await open();
    await dialog().getByRole('button', { name: 'Executable location', exact: true }).click();
    const path = dialog().getByRole('textbox', {
      name: 'Custom executable path (optional)',
      exact: true,
    });
    await path.fill('C:\\Fixture\\acknowledged.exe');
    await dialog().getByRole('button', { name: 'Save executable path', exact: true }).click();
    await dialog()
      .getByRole('alert')
      .filter({ hasText: /accepted.*refresh|saved.*refresh|refresh.*accepted/i })
      .waitFor();
    await expect
      .poll(() =>
        dialog().getByRole('button', { name: 'Save executable path', exact: true }).isDisabled(),
      )
      .toBe(true);
    expect(await path.inputValue()).toBe('C:\\Fixture\\acknowledged.exe');
    expect(configure).toHaveBeenCalledTimes(1);
    await dialog().getByRole('button', { name: 'Close dialog', exact: true }).click();
    await dialog().waitFor({ state: 'detached' });
    expect(
      await page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true }).count(),
    ).toBe(0);
  },
);

test('native sign-in resumes after closing and cancels the exact flow without exposing it in snapshots', async () => {
  vi.spyOn(host.daemon.service.runtimeAuth, 'start').mockImplementation(() => {
    auth = {
      ...auth,
      id: 'fixture-flow',
      stage: 'waiting',
      detail: 'Finish sign-in in your browser.',
      url: 'https://auth.openai.com/authorize?state=fixture-private',
      startedAt: new Date().toISOString(),
    };
    return auth;
  });
  const cancel = vi
    .spyOn(host.daemon.service.runtimeAuth, 'cancel')
    .mockImplementation(async () => {
      auth = {
        ...auth,
        stage: 'cancelled',
        detail: 'Sign-in cancelled.',
        finishedAt: new Date().toISOString(),
      };
      delete auth.url;
      return auth;
    });
  await open();
  await dialog().getByRole('tab', { name: '2. Sign-in', exact: true }).click();
  await dialog().getByRole('button', { name: 'Sign in with ChatGPT', exact: true }).click();
  const link = dialog().getByRole('link', { name: 'Open sign-in page', exact: true });
  await link.waitFor();
  expect(await link.getAttribute('rel')).toBe('noreferrer');
  expect(JSON.stringify((await host.request('/snapshot')).result)).not.toContain('fixture-private');
  await capture('v1-native-signin-waiting');
  await dialog().getByRole('button', { name: 'Close dialog', exact: true }).click();
  await dialog().waitFor({ state: 'detached' });
  await page
    .getByRole('article', { name: 'Codex', exact: true })
    .getByRole('button', { name: 'Manage Codex', exact: true })
    .click();
  await dialog().getByRole('tab', { name: '2. Sign-in', exact: true }).click();
  await link.waitFor();
  await dialog().getByRole('button', { name: 'Cancel sign-in', exact: true }).click();
  await dialog().getByRole('button', { name: 'Retry sign-in', exact: true }).waitFor();
  expect(cancel).toHaveBeenCalledWith('codex', 'fixture-flow');
});

test('missing runtime installation shows bounded progress and operation-scoped cancellation', async () => {
  host.daemon.service.runtimeMaintenance.context().runtimes = [
    { ...codex, available: false, version: '', detail: 'Fictional missing installation.' },
  ];
  setupInfo = {
    ...setupInfo,
    executable: null,
    realPath: null,
    canInstall: true,
    installDetail: 'Installs the official npm distribution inside the workspace data folder.',
  };
  const install = vi
    .spyOn(host.daemon.service.runtimeSetup, 'install')
    .mockImplementation(async () => {
      setupInfo = {
        ...setupInfo,
        canInstall: false,
        operation: {
          id: 'fixture-install',
          stage: 'installing',
          startedAt: new Date().toISOString(),
          finishedAt: null,
          detail: 'Installing a fictional distribution…',
          output: '',
        },
      };
      return setupInfo;
    });
  const cancel = vi
    .spyOn(host.daemon.service.runtimeSetup, 'cancel')
    .mockImplementation(async () => {
      setupInfo = {
        ...setupInfo,
        canInstall: true,
        operation: {
          ...setupInfo.operation!,
          stage: 'cancelled',
          finishedAt: new Date().toISOString(),
          detail: 'Installation cancelled. No executable was selected.',
        },
      };
      return setupInfo;
    });
  await open();
  expect(
    await dialog().getByRole('button', { name: 'Continue to sign-in', exact: true }).isDisabled(),
  ).toBe(true);
  await dialog().getByRole('button', { name: 'Install runtime', exact: true }).click();
  await dialog().getByText('Installing a fictional distribution…', { exact: true }).waitFor();
  expect(install).toHaveBeenCalledTimes(1);
  await capture('v1-installation-progress');
  await dialog().getByRole('button', { name: 'Cancel installation', exact: true }).click();
  await dialog()
    .getByText('Installation cancelled. No executable was selected.', { exact: true })
    .waitFor();
  expect(cancel).toHaveBeenCalledWith('codex', 'fixture-install');
});

test('setup stays named and bounded on a dark touch viewport across all three sections', async () => {
  await page.close();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  page = await context.newPage();
  await open();
  for (const [section, name] of [
    ['installation', '1. Installation'],
    ['signin', '2. Sign-in'],
    ['models', '3. Models'],
  ]) {
    await dialog().getByRole('tab', { name, exact: true }).click();
    if (section === 'models')
      await dialog().getByRole('button', { name: 'Add custom model', exact: true }).waitFor();
    const bounds = await dialog().boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    expect(await dialog().evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    // Tab panels stay mounted and hide asynchronously. Read visibility and size in
    // one browser evaluation so a selected button cannot hide between the two.
    const undersized = await dialog().evaluate((element) =>
      Array.from(element.querySelectorAll('button'))
        .filter((button) => button.checkVisibility() && button.getBoundingClientRect().height < 44)
        .map((button) => button.textContent),
    );
    expect(undersized).toEqual([]);
    const narrowIcons = await dialog().evaluate((element) =>
      Array.from(element.querySelectorAll('button[data-size^="icon"], button.icon-button'))
        .filter((button) => button.checkVisibility() && button.getBoundingClientRect().width < 44)
        .map((button) => button.getAttribute('aria-label')),
    );
    expect(narrowIcons).toEqual([]);
    await capture(`v1-phone-dark-${section}`);
  }
  await context.close();
});

test('manual installation can recheck and continue without leaving the setup dialog', async () => {
  host.daemon.service.runtimeMaintenance.context().runtimes = [
    { ...codex, available: false, version: '', detail: 'Install manually, then recheck.' },
  ];
  setupInfo = {
    ...setupInfo,
    executable: null,
    realPath: null,
    installDetail: 'Use the official native installer, then recheck.',
  };
  const detect = vi.spyOn(host.daemon.service, 'detect').mockImplementation(async () => {
    setupInfo = { ...setupInfo, executable: 'C:\\Fixture\\codex.exe' };
    host.daemon.service.runtimeMaintenance.context().runtimes = [structuredClone(codex)];
    return [codex];
  });
  await open();
  await dialog().getByRole('button', { name: 'Recheck installation', exact: true }).click();
  await dialog().getByText('Compatible installation found', { exact: true }).waitFor();
  await expect
    .poll(() =>
      dialog().getByRole('button', { name: 'Continue to sign-in', exact: true }).isEnabled(),
    )
    .toBe(true);
  expect(detect).toHaveBeenCalledTimes(1);
});

test('Claude code entry, verification and expiry keep private values out of snapshots and restore focus', async () => {
  host.daemon.service.runtimeMaintenance.context().runtimes = [{ ...codex, id: 'claude-code' }];
  setupInfo = { ...setupInfo, id: 'claude-code' };
  auth = {
    ...auth,
    runtime: 'claude-code',
    id: 'fixture-claude-flow',
    stage: 'waiting',
    codeRequested: true,
    url: 'https://claude.ai/oauth/authorize?state=fixture-private',
    detail: 'Paste the code from Claude.',
    expiresAt: new Date(Date.now() + 300000).toISOString(),
  };
  const respond = vi.spyOn(host.daemon.service.runtimeAuth, 'respond').mockImplementation(() => {
    auth = {
      ...auth,
      stage: 'verifying',
      detail: 'Checking account readiness…',
      codeRequested: false,
    };
    delete auth.url;
    return auth;
  });
  await page.goto(`${host.daemon.url}/settings?section=runtimes`);
  await page
    .getByRole('article', { name: 'Claude Code', exact: true })
    .getByRole('button', { name: 'Manage Claude Code', exact: true })
    .click();
  const claude = page.getByRole('dialog', { name: 'Set up Claude Code', exact: true });
  const code = claude.getByLabel('Code from the sign-in page', { exact: true });
  await expect
    .poll(() => code.evaluate((element) => document.activeElement === element))
    .toBe(true);
  await code.fill('fixture-private-code');
  await capture('v2-claude-code-entry');
  await claude.getByRole('button', { name: 'Continue sign-in', exact: true }).click();
  await claude.getByText('Checking account readiness…', { exact: true }).waitFor();
  expect(respond).toHaveBeenCalledWith(
    'claude-code',
    'fixture-claude-flow',
    'fixture-private-code',
  );
  await expect
    .poll(() =>
      claude
        .getByRole('button', { name: 'Cancel sign-in', exact: true })
        .evaluate((element) => document.activeElement === element),
    )
    .toBe(true);
  await capture('v2-claude-verifying');
  auth = {
    ...auth,
    stage: 'failed',
    detail: 'Sign-in expired. Retry to get a new link.',
    finishedAt: new Date().toISOString(),
  };
  const retry = claude.getByRole('button', { name: 'Retry sign-in', exact: true });
  await retry.waitFor();
  await expect
    .poll(() => retry.evaluate((element) => document.activeElement === element))
    .toBe(true);
  expect(JSON.stringify((await host.request('/snapshot')).result)).not.toContain('fixture-private');
  await capture('v2-claude-expired');
});

test('failed installation offers readable output and an idle recheck inside the dialog', async () => {
  host.daemon.service.runtimeMaintenance.context().runtimes = [
    { ...codex, available: false, version: '', detail: 'Fictional installation is unavailable.' },
  ];
  setupInfo = {
    ...setupInfo,
    canInstall: true,
    operation: {
      id: 'fixture-failed',
      stage: 'failed',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      detail: 'The installer failed. Review its output and retry.',
      output: 'Fictional installer: check disk space and permissions.',
    },
  };
  await open();
  await dialog()
    .getByText('The installer failed. Review its output and retry.', { exact: true })
    .waitFor();
  await dialog().getByRole('button', { name: 'Installer output', exact: true }).click();
  await dialog()
    .getByText('Fictional installer: check disk space and permissions.', { exact: true })
    .waitFor();
  expect(
    await dialog().getByRole('button', { name: 'Recheck installation', exact: true }).isEnabled(),
  ).toBe(true);
  expect(
    await dialog().getByRole('button', { name: 'Cancel installation', exact: true }).count(),
  ).toBe(0);
  expect(
    await dialog().getByRole('button', { name: 'Retry installation', exact: true }).isEnabled(),
  ).toBe(true);
  await capture('v2-installation-failed');
});

test('a recovered installation keeps a failed attempt collapsed as history', async () => {
  setupInfo = {
    ...setupInfo,
    operation: {
      id: 'fixture-historical-failure',
      stage: 'failed',
      startedAt: new Date(Date.now() - 60000).toISOString(),
      finishedAt: new Date(Date.now() - 30000).toISOString(),
      detail: 'A previous fictional installation failed.',
      output: 'Fictional previous installer diagnostics.',
    },
  };
  await open();
  await dialog().getByText('Compatible installation found', { exact: true }).waitFor();
  const previous = dialog().getByRole('button', {
    name: 'Previous installation attempt',
    exact: true,
  });
  await previous.waitFor();
  expect(await previous.getAttribute('aria-expanded')).toBe('false');
  expect(
    await dialog()
      .getByText('A previous fictional installation failed.', { exact: true })
      .isVisible(),
  ).toBe(false);
  expect(
    await dialog().getByRole('button', { name: 'Continue to sign-in', exact: true }).isEnabled(),
  ).toBe(true);
  await previous.click();
  await dialog().getByText('A previous fictional installation failed.', { exact: true }).waitFor();
  await dialog().getByRole('button', { name: 'Installer output', exact: true }).click();
  await dialog().getByText('Fictional previous installer diagnostics.', { exact: true }).waitFor();
});

test('a light touch viewport keeps native sign-in primary action reachable and accurately names readiness', async () => {
  await page.close();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
    ...auth,
    id: 'fixture-phone-flow',
    stage: 'waiting',
    url: 'https://auth.openai.com/authorize?state=fixture-phone',
    detail: 'Open the sign-in page and finish with ChatGPT.',
    expiresAt: new Date(Date.now() + 300000).toISOString(),
  };
  await open();
  await dialog().getByRole('tab', { name: '2. Sign-in', exact: true }).click();
  const link = dialog().getByRole('link', { name: 'Open sign-in page', exact: true });
  await link.waitFor();
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await dialog().getByRole('button', { name: 'Recheck sign-in', exact: true }).count()).toBe(
    0,
  );
  expect(
    await dialog()
      .getByRole('button', { name: 'Skip to models', exact: true })
      .getAttribute('data-variant'),
  ).toBe('ghost');
  await capture('v2-phone-light-signin');
  await context.close();
});

test('a historical successful sign-in never overrides a newer missing account check', async () => {
  const manager = host.daemon.service.runtimeMaintenance;
  manager.authenticationEnabled = true;
  vi.spyOn(manager.host, 'authenticate').mockResolvedValue({
    status: 'missing',
    detail: 'Current CLI account is signed out.',
    checkedAt: new Date().toISOString(),
    instructions: 'Sign in again.',
  });
  await manager.authenticate({ runtime: 'codex', model: '' }, true);
  auth = {
    ...auth,
    id: 'old-success',
    stage: 'succeeded',
    detail: 'Old successful sign-in.',
    finishedAt: '2026-01-01T00:00:00Z',
  };
  await open();
  await dialog().getByRole('tab', { name: '2. Sign-in', exact: true }).click();
  await dialog().getByRole('heading', { name: 'Connect your account', exact: true }).waitFor();
  expect(await dialog().getByText('Your account is connected', { exact: true }).count()).toBe(0);
  expect(await dialog().getByText('Signed in', { exact: true }).count()).toBe(0);
  expect(
    await dialog()
      .getByRole('button', { name: 'Skip to models', exact: true })
      .getAttribute('data-variant'),
  ).toBe('ghost');
  await capture('v3-historical-signin-outdated');
});
