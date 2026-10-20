import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adapters, type RuntimeInstallation } from '../../adapters/src/index.ts';
import type { RuntimeInfo } from '@pitchcrew/core';
import { cleanup, setup } from '../../orchestrator/test/helpers/daemon.ts';

const viteCache = vi.hoisted(() => ({ directory: '' }));
vi.mock('vite', async (importOriginal) => {
  const vite = await importOriginal<typeof import('vite')>();
  return {
    ...vite,
    createServer: (config: import('vite').InlineConfig) =>
      vite.createServer({ ...config, cacheDir: viteCache.directory }),
  };
});

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
  await page.getByRole('tab', { name: 'Runtimes', exact: true }).waitFor();
};

beforeAll(async () => {
  viteCache.directory = await mkdtemp(join(tmpdir(), 'pitchcrew-runtime-settings-cache-'));
  host = await setup(15751);
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
  await rm(viteCache.directory, { recursive: true, force: true });
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
  await row().getByRole('button', { name: 'Set up Codex', exact: true }).click();
  expect(await row().getByText('fixture manual update', { exact: true }).count()).toBe(1);
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
  await row().getByRole('button', { name: 'Set up Codex', exact: true }).click();
  await row().getByText('Sign in using your CLI, then recheck.', { exact: true }).waitFor();
  expect(await row().getByText('fixture login', { exact: true }).isVisible()).toBe(true);
  expect(await row().getByText('fixture manual update', { exact: true }).isVisible()).toBe(true);
  expect(
    await row().getByRole('button', { name: 'Update Codex to 1.1.0', exact: true }).count(),
  ).toBe(0);
  await open('section=runtimes&runtime=gemini-cli#runtime-gemini-cli');
  await page.getByText('Install the fictional CLI, then recheck.', { exact: true }).waitFor();
}, 30000);

test('mobile deep links keep the selected tab visible and retain keyboard navigation in dark mode', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('pitchcrew-theme', 'dark'));
  await manager().check();
  await open('section=privacy');
  const privacy = page.getByRole('tab', { name: 'Privacy', exact: true });
  await expect
    .poll(async () => {
      const box = await privacy.boundingBox();
      return !!box && box.x >= 0 && box.x + box.width <= 390;
    })
    .toBe(true);
  await page.getByRole('switch', { name: 'Share anonymous usage', exact: true }).waitFor();
  await privacy.focus();
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('heading', { name: 'Pitchcrew updates', exact: true }).waitFor();
  await page.getByRole('link', { name: /Runtime updates/ }).click();
  await row().getByRole('button', { name: 'Update Codex to 1.1.0', exact: true }).waitFor();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await row().evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
}, 30000);
