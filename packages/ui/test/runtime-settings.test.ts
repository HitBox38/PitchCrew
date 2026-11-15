import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { adapters, type RuntimeInstallation } from '../../adapters/src/index.ts';
import type { RuntimeInfo } from '@pitchcrew/core';
import { cleanup, setup } from './helpers/daemon.ts';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const capture = async (name: string) => {
  if (!process.env.PITCHCREW_SETTINGS_EVIDENCE) return;
  const directory = resolve(process.env.PITCHCREW_SETTINGS_EVIDENCE);
  await mkdir(directory, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(directory, name) });
};

const codex: RuntimeInfo = {
  id: 'codex',
  available: true,
  version: '1.0.0',
  detail: 'Fictional Codex installation',
  models: [],
  modelSource: 'none',
  modelDetail: '',
};
const installation: RuntimeInstallation = {
  executable: '/fixture/codex',
  realPath: '/fixture/codex',
  identity: 'fictional-npm',
  installer: 'npm',
  command: { file: '/fixture/npm', args: ['update'] },
  manualCommand: 'fixture manual update',
  detail: 'Verified fictional installer',
};
let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let finish: (() => void) | undefined;
const errors: string[] = [];
const manager = () => host.daemon.service.runtimeMaintenance;
const row = () => page.getByRole('article', { name: 'Codex', exact: true });
const open = async (query = 'section=runtimes') => {
  await page.goto(`${host.daemon.url}/settings?${query}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Find a setting', exact: true }).waitFor();
  if (query.includes('section=runtimes')) await page.locator('#runtime-heading').waitFor();
};

beforeAll(async () => {
  host = await setup(false, { dev: false });
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  browser = await chromium.launch({ headless: true });
}, 60000);
beforeEach(async () => {
  errors.length = 0;
  manager().enabled = true;
  manager().authenticationEnabled = true;
  manager().clearAuthentication('codex');
  manager().context().runtimes = [
    structuredClone(codex),
    {
      ...codex,
      id: 'gemini-cli',
      available: false,
      version: '',
      detail: 'Install the fictional CLI, then recheck.',
    },
  ];
  manager().store.state.updates = [];
  manager().configure(false);
  vi.spyOn(host.daemon.service, 'detect').mockImplementation(
    async () => manager().context().runtimes,
  );
  vi.spyOn(manager().host, 'detect').mockImplementation(async () => manager().context().runtimes);
  vi.spyOn(manager().host, 'resolve').mockResolvedValue(installation);
  vi.spyOn(manager().host, 'latest').mockResolvedValue('1.1.0');
  vi.spyOn(manager().host, 'authenticate').mockResolvedValue({
    status: 'missing',
    checkedAt: new Date().toISOString(),
    detail: 'Fictional sign-in needed',
    instructions: 'Sign in using your CLI, then recheck.',
    command: 'fixture login',
  });
  vi.spyOn(adapters.codex, 'detect').mockResolvedValue(codex);
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
});
afterEach(async () => {
  finish?.();
  finish = undefined;
  await Promise.all(manager().active.values());
  await page?.close();
  vi.restoreAllMocks();
  expect(errors).toEqual([]);
});
afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('checks releases and updates from the collapsed row; progress survives navigation', async () => {
  const run = vi.spyOn(manager().host, 'run').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ code: 0, stdout: '', stderr: '' });
      }),
  );
  await open();
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  const update = row().getByRole('button', { name: 'Update Codex to 1.1.0', exact: true });
  await update.waitFor();
  expect(await row().getByText('Update available: 1.1.0', { exact: true }).isVisible()).toBe(true);
  expect(await row().getByText('Verified fictional installer', { exact: true }).isVisible()).toBe(
    false,
  );
  expect(await row().getByText('Sign-in needed', { exact: true }).isVisible()).toBe(true);
  expect(await update.getAttribute('data-variant')).toBe('ghost');
  await capture('v6-fixture-runtime-update.png');
  vi.mocked(adapters.codex.detect)
    .mockResolvedValueOnce(codex)
    .mockResolvedValue({ ...codex, version: '1.1.0' });
  await update.click();
  await row().getByText('Installing update…', { exact: true }).waitFor();
  expect(run).toHaveBeenCalledTimes(1);
  expect(
    await row().getByRole('button', { name: 'Updating… Codex', exact: true }).isDisabled(),
  ).toBe(true);
  await page.getByRole('tab', { name: 'Updates', exact: true }).click();
  await page.getByRole('heading', { name: 'Pitchcrew updates' }).waitFor();
  await page.getByRole('link', { name: /Runtime updates/ }).click();
  await row().getByText('Installing update…', { exact: true }).waitFor();
  finish!();
  await row().getByText('Runtime updated', { exact: true }).waitFor();
  await row().getByText('Up to date', { exact: true }).waitFor();
  expect(await row().getByText('1.1.0', { exact: true }).isVisible()).toBe(true);
  expect(await row().getByText('Sign-in needed', { exact: true }).isVisible()).toBe(true);
}, 45000);

test('explains busy runtimes and shows a copyable manual command beside installer failures', async () => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as Window & { copiedRuntimeCommand?: string }).copiedRuntimeCommand = value;
        },
      },
    });
  });
  const busy = vi.spyOn(manager(), 'busy').mockReturnValue(['Scout is using this runtime.']);
  const run = vi
    .spyOn(manager().host, 'run')
    .mockResolvedValue({ code: 1, stdout: '', stderr: 'Fictional failure' });
  await manager().check();
  await open();
  const update = row().getByRole('button', { name: 'Update Codex to 1.1.0', exact: true });
  await update.waitFor();
  expect(await update.isDisabled()).toBe(true);
  expect(
    await row()
      .getByText(/Wait until this runtime is idle/)
      .isVisible(),
  ).toBe(true);
  expect(run).not.toHaveBeenCalled();
  busy.mockReturnValue([]);
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect.poll(() => update.isEnabled(), { timeout: 10000 }).toBe(true);
  await update.click();
  await row().getByText('Update failed', { exact: true }).waitFor();
  await row().getByRole('button', { name: 'Retry update Codex to 1.1.0', exact: true }).waitFor();
  expect(await page.getByText('Runtime update started', { exact: true }).count()).toBe(0);
  expect(
    await row()
      .getByText(/The installer failed/)
      .isVisible(),
  ).toBe(true);
  expect(run).toHaveBeenCalledTimes(1);
  expect(await row().getByText('fixture manual update', { exact: true }).isVisible()).toBe(true);
  expect(
    await row()
      .getByRole('button', { name: 'Copy Manual update command', exact: true })
      .isVisible(),
  ).toBe(true);
  await row().getByRole('button', { name: 'Copy Manual update command', exact: true }).click();
  expect(
    await page.evaluate(
      () => (window as Window & { copiedRuntimeCommand?: string }).copiedRuntimeCommand,
    ),
  ).toBe('fixture manual update');
  expect(await row().getByText('Verified fictional installer', { exact: true }).isVisible()).toBe(
    false,
  );
  await row().getByRole('button', { name: 'Details for Codex', exact: true }).click();
  expect(await row().getByText('fixture manual update', { exact: true }).count()).toBe(1);
  await capture('v6-fixture-runtime-error.png');
}, 30000);

test('manual updates and sign-in instructions open directly; unavailable deep links expand', async () => {
  vi.mocked(manager().host.resolve).mockResolvedValue({
    ...installation,
    command: undefined,
    installer: 'manual',
    detail: 'Update this CLI through its original installer.',
  });
  await manager().check();
  await manager().authenticate({ runtime: 'codex', model: '' });
  await open();
  await row().getByRole('button', { name: 'Update instructions for Codex', exact: true }).click();
  await row().getByText('Sign in using your CLI, then recheck.', { exact: true }).waitFor();
  expect(await row().locator('.settings-runtime-details > div').first().innerText()).toContain(
    'Sign-in needed',
  );
  expect(await row().getByText('fixture login', { exact: true }).isVisible()).toBe(true);
  expect(await row().getByText('fixture manual update', { exact: true }).isVisible()).toBe(true);
  expect(
    await row().getByRole('button', { name: 'Update Codex to 1.1.0', exact: true }).count(),
  ).toBe(0);
  await open('section=runtimes&runtime=gemini-cli#runtime-gemini-cli');
  await page.getByText('Install the fictional CLI, then recheck.', { exact: true }).waitFor();
  await expect
    .poll(() =>
      page.locator('#runtime-gemini-cli').evaluate((element) => document.activeElement === element),
    )
    .toBe(true);
}, 30000);

test('mobile deep links show the selected section and support keyboard selection in dark mode', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('pitchcrew-theme', 'dark'));
  await manager().check();
  await open('section=privacy');
  const privacy = page.getByRole('combobox', { name: 'Settings section', exact: true });
  await expect
    .poll(async () => {
      const box = await privacy.boundingBox();
      return !!box && box.x >= 0 && box.x + box.width <= 390;
    })
    .toBe(true);
  await page.getByRole('switch', { name: 'Share anonymous usage', exact: true }).waitFor();
  await page.getByRole('region', { name: 'Privacy', exact: true }).waitFor();
  await privacy.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('option', { name: 'Updates', exact: true }).click();
  await page.getByRole('heading', { name: 'Pitchcrew updates', exact: true }).waitFor();
  await page.getByRole('link', { name: /Runtime updates/ }).click();
  await row().getByRole('button', { name: 'Update Codex to 1.1.0', exact: true }).waitFor();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await row().evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
}, 30000);

test('prioritizes setup, incompatible versions and failed updates without redundant healthy chips', async () => {
  manager().context().runtimes = [
    { ...codex, id: 'claude-code' },
    codex,
    {
      ...codex,
      id: 'opencode',
      available: false,
      detail: 'Upgrade OpenCode to a supported version, then recheck.',
    },
    { ...codex, id: 'gemini-cli' },
  ];
  await manager().authenticate({ runtime: 'codex', model: '' });
  manager().store.state.updates = [
    {
      id: 'gemini-cli',
      status: 'available',
      installedVersion: '1.0.0',
      latestVersion: '1.1.0',
      checkedAt: null,
      lastSuccessAt: null,
      detail: 'Fictional failed update',
      installer: 'manual',
      canUpdate: false,
      manualCommand: '',
      operation: {
        id: 'failed-fixture',
        stage: 'failed',
        startedAt: '2026-01-01T00:00:00.000Z',
        finishedAt: '2026-01-01T00:00:01.000Z',
        detail: 'Fictional installer failure',
        output: '',
      },
    },
  ];
  await open();
  expect(
    await page.locator('.settings-runtime').evaluateAll((rows) => rows.map((row) => row.id)),
  ).toEqual(['runtime-codex', 'runtime-opencode', 'runtime-gemini-cli', 'runtime-claude-code']);
  expect(
    await row()
      .getByRole('button', { name: 'Set up Codex', exact: true })
      .getAttribute('data-variant'),
  ).toBe('outline');
  expect(await page.getByText('Incompatible version', { exact: true }).isVisible()).toBe(true);
  const incompatible = page.getByRole('article', { name: 'OpenCode', exact: true });
  expect(
    await incompatible.getByRole('button', { name: 'Set up OpenCode', exact: true }).isVisible(),
  ).toBe(true);
  expect(
    await incompatible
      .getByText('Upgrade OpenCode to a supported version, then recheck.', { exact: true })
      .isVisible(),
  ).toBe(true);
  expect(
    await page
      .getByText('3 runtimes need attention · 1 update available.', { exact: true })
      .isVisible(),
  ).toBe(true);
  expect(await page.getByText('Update failed', { exact: true }).isVisible()).toBe(true);
  await capture('v6-fixture-runtime-attention.png');
  expect(await page.getByText('Compatible', { exact: true }).count()).toBe(0);
  expect(
    await page
      .getByRole('article', { name: 'Claude Code', exact: true })
      .getByText('Sign-in not checked', { exact: true })
      .isVisible(),
  ).toBe(true);
  expect(
    await page
      .getByRole('article', { name: 'Claude Code', exact: true })
      .getByText('Sign-in not checked', { exact: true })
      .getAttribute('class'),
  ).toBe('ui-row-meta');
}, 30000);

test('keeps disabled update preferences discoverable and describes the actual recheck action', async () => {
  manager().enabled = false;
  await open();
  await page.getByRole('button', { name: 'Recheck installations', exact: true }).waitFor();
  const preference = page.getByRole('switch', {
    name: 'Check for updates daily',
    exact: true,
  });
  expect(await preference.isVisible()).toBe(false);
  await page.getByRole('button', { name: 'Find a setting', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Find a setting', exact: true })
    .getByRole('combobox')
    .fill('automatic runtime');
  await page.getByRole('option', { name: /Automatic runtime update checks/ }).click();
  await preference.waitFor();
  expect(await preference.isDisabled()).toBe(true);
  await expect
    .poll(() =>
      preference.evaluate((element) => document.activeElement === element.closest('label')),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Update checks disabled', exact: true }).click();
  expect(await preference.isVisible()).toBe(false);
  await page.getByRole('button', { name: 'Find a setting', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Find a setting', exact: true })
    .getByRole('combobox')
    .fill('automatic runtime');
  await page.getByRole('option', { name: /Automatic runtime update checks/ }).click();
  await preference.waitFor();
  expect(
    await page
      .getByText('Release checks are disabled for this installation.', { exact: true })
      .isVisible(),
  ).toBe(true);
}, 30000);

test('a failed update stays visible when its CLI is no longer detected', async () => {
  manager().context().runtimes = [
    { ...codex, available: false, version: '' },
    { ...codex, id: 'gemini-cli', available: false, version: '' },
  ];
  manager().store.state.updates = [
    {
      id: 'codex',
      status: 'unknown',
      installedVersion: '1.0.0',
      latestVersion: null,
      checkedAt: null,
      lastSuccessAt: null,
      detail: 'Installer removed the executable before failing.',
      installer: 'manual',
      canUpdate: false,
      manualCommand: 'fixture reinstall',
      operation: {
        id: 'missing-after-failure',
        stage: 'failed',
        startedAt: '2026-01-01T00:00:00Z',
        finishedAt: '2026-01-01T00:00:01Z',
        detail: 'Reinstall the CLI, then recheck.',
        output: '',
      },
    },
  ];
  await open();
  await row().waitFor();
  expect(await row().getByText('Update failed', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('1 runtime needs attention.', { exact: true }).isVisible()).toBe(
    true,
  );
  expect(await page.getByRole('article', { name: 'Gemini CLI', exact: true }).isVisible()).toBe(
    false,
  );
  await capture('v6-fixture-runtime-missing-after-failure.png');
}, 30000);
