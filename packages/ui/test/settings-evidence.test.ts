import { chromium, type Browser } from 'playwright';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import type {
  AppUpdateInfo,
  BackgroundServiceInfo,
  ConnectorStatus,
  ExternalMcpInfo,
} from '@pitchcrew/core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cleanup, setup } from './helpers/daemon.ts';
import { captureSettings } from './helpers/settings-capture.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
beforeAll(async () => {
  host = await setup(false, { dev: false });
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  browser = await chromium.launch({ headless: true });
}, 60000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
});
afterEach(() => vi.restoreAllMocks());

test('settings sections remain named, bounded and operable on desktop and touch devices', async () => {
  const output = process.env.PITCHCREW_SETTINGS_EVIDENCE;
  if (output) await mkdir(resolve(output), { recursive: true });
  expect(
    host.daemon.service.runtimeMaintenance.context().runtimes.some((r) => r.id === 'demo'),
  ).toBe(false);
  for (const phone of [false, true]) {
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      hasTouch: phone,
      isMobile: phone,
      reducedMotion: 'reduce',
      colorScheme: phone ? 'dark' : 'light',
    });
    await context.addInitScript(() =>
      localStorage.setItem('pitchcrew-analytics-enabled-v1', 'false'),
    );
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const [section, label] of Object.entries({
      general: 'General',
      accounts: 'Accounts',
      sources: 'Job sources',
      runtimes: 'Runtimes',
      writing: 'Writing',
      rules: 'Packet rules',
      updates: 'Updates',
      privacy: 'Privacy',
      data: 'Local data',
    })) {
      await page.goto(`${host.daemon.url}/settings?section=${section}`);
      const panel = page.getByRole(phone ? 'region' : 'tabpanel', { name: label, exact: true });
      await panel.waitFor();
      await page
        .locator('.settings-column')
        .getByText(/Loading settings/)
        .waitFor({ state: 'detached' });
      await page.evaluate(() => document.fonts.ready);
      if (section === 'data')
        await panel
          .getByText('Checking the background service…', { exact: true })
          .waitFor({ state: 'detached' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (section === 'general') {
        const introduction = await page
          .getByRole('button', { name: 'Show introduction', exact: true })
          .boundingBox();
        expect(introduction!.y + introduction!.height).toBeLessThan(phone ? 844 : 800);
      }
      if (phone) {
        const controls = await panel
          .locator('button:visible, [role="switch"]:visible, [role="combobox"]:visible')
          .evaluateAll((nodes) =>
            nodes
              .filter(
                (e) =>
                  (['switch', 'checkbox'].includes(e.getAttribute('role') ?? '')
                    ? (e.closest('label') ?? e)
                    : e
                  ).getBoundingClientRect().height < 44 ||
                  (e.getAttribute('data-size')?.startsWith('icon') &&
                    e.getBoundingClientRect().width < 44),
              )
              .map((e) => e.getAttribute('aria-label') ?? e.textContent),
          );
        expect(controls).toEqual([]);
      }
      await captureSettings(page, `v6-${phone ? 'phone-dark' : 'desktop'}-${section}`);
    }
    expect(errors).toEqual([]);
    await context.close();
  }
}, 90000);

test('populated and configured fixtures expose complete settings and phone rule selection', async () => {
  const output = process.env.PITCHCREW_SETTINGS_EVIDENCE;
  if (output) await mkdir(resolve(output), { recursive: true });
  const source = await host.daemon.service.jobSources.add({
    provider: 'greenhouse',
    slug: 'fixture-board',
    name: 'Fixture Company',
    enabled: true,
    filters: {
      titleInclude: ['Frontend'],
      titleExclude: [],
      locationInclude: [],
      remoteOnly: false,
    },
  });
  const connectors: ConnectorStatus[] = [
    {
      id: 'github',
      connected: true,
      account: 'fixture-user',
      services: ['github'],
      configured: true,
      pending: false,
      error: '',
      connectionMethod: 'cli',
    },
  ];
  vi.spyOn(host.daemon.service.connectors, 'status').mockReturnValue(connectors);
  const info: AppUpdateInfo = {
    current: { version: '0.18.0', commit: 'a'.repeat(40), packaged: false },
    automatic: true,
    status: 'current',
    checkedAt: '2026-11-07T02:00:00Z',
    latest: null,
    message: 'You are running the latest published version.',
  };
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() =>
    localStorage.setItem('pitchcrew-analytics-enabled-v1', 'false'),
  );
  const page = await context.newPage();
  // Public configuration fixtures only: consent is off and all analytics traffic is intercepted.
  await page.route('**/api/analytics/config', (r) =>
    r.fulfill({ json: { token: 'phc_fixture_not_a_credential', host: 'https://example.invalid' } }),
  );
  await page.route('https://example.invalid/**', (r) => r.fulfill({ json: {} }));
  await page.route('**/api/app-updates**', (r) => r.fulfill({ json: info }));
  for (const section of ['accounts', 'sources', 'updates', 'privacy']) {
    await page.goto(`${host.daemon.url}/settings?section=${section}`);
    await page.locator('.settings-content:not([hidden]) .settings-section').first().waitFor();
    if (section === 'accounts')
      await page.getByRole('article', { name: 'GitHub access', exact: true }).waitFor();
    if (section === 'sources')
      await page.getByRole('switch', { name: 'Watch Fixture Company', exact: true }).waitFor();
    if (section === 'updates') await page.getByText(info.message, { exact: true }).waitFor();
    if (section === 'privacy')
      await page
        .getByText('Usage analytics is available in this installation.', { exact: true })
        .waitFor();
    await page.evaluate(() => document.fonts.ready);
    await captureSettings(page, `v6-fixture-desktop-dark-${section}`);
  }
  await page.getByRole('switch', { name: 'Share anonymous usage', exact: true }).click();
  await captureSettings(page, 'v6-fixture-desktop-dark-privacy-on');
  await page.goto(`${host.daemon.url}/settings?section=accounts`);
  const github = page.getByRole('article', { name: 'GitHub access', exact: true });
  await github.getByRole('button', { name: 'Choose agents', exact: true }).click();
  await captureSettings(page, 'v6-fixture-accounts-choose-agents');
  await page.goto(`${host.daemon.url}/settings?section=sources`);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Company name', exact: true }).waitFor();
  await captureSettings(page, 'v6-fixture-source-editor');
  await page.goto(`${host.daemon.url}/settings?section=writing`);
  await page.getByRole('button', { name: 'Add preference', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Preference', exact: true })
    .fill('Use concrete evidence and concise sentences.');
  await page.getByRole('button', { name: 'Save preference', exact: true }).click();
  await page.getByText('Use concrete evidence and concise sentences.', { exact: true }).waitFor();
  await captureSettings(page, 'v6-fixture-writing-preference');
  await page
    .locator('#detector-sapling')
    .getByRole('button', { name: 'Add key', exact: true })
    .click();
  const keyField = page.getByLabel('Sapling API key', { exact: true });
  const keyTrigger = page.locator('#detector-sapling-key-trigger');
  await expect.poll(() => keyField.evaluate((e) => document.activeElement === e)).toBe(true);
  await captureSettings(page, 'v6-fixture-detector-key-form');
  await page
    .locator('#detector-sapling')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect.poll(() => keyTrigger.evaluate((e) => document.activeElement === e)).toBe(true);
  await keyTrigger.click();
  await keyField.fill('fixture-not-a-real-service-key');
  await page
    .locator('#detector-sapling')
    .getByRole('button', { name: 'Save key', exact: true })
    .click();
  await expect.poll(() => keyTrigger.innerText()).toBe('Replace key');
  await expect.poll(() => keyTrigger.evaluate((e) => document.activeElement === e)).toBe(true);
  await captureSettings(page, 'v6-fixture-detector-key-saved');
  const otherTrigger = page.locator('#detector-gptzero-key-trigger');
  await otherTrigger.click();
  const otherKey = page.getByLabel('GPTZero API key', { exact: true });
  await otherKey.fill('fixture-unsaved-draft');
  await page
    .locator('#detector-sapling')
    .getByRole('button', { name: 'Remove', exact: true })
    .click();
  await expect.poll(() => keyTrigger.innerText()).toBe('Add key');
  expect(await otherKey.inputValue()).toBe('fixture-unsaved-draft');
  await expect.poll(() => keyTrigger.evaluate((e) => document.activeElement === e)).toBe(true);
  await page
    .locator('#detector-gptzero')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect.poll(() => otherTrigger.evaluate((e) => document.activeElement === e)).toBe(true);
  await keyTrigger.click();
  await keyField.fill('fixture-not-a-real-service-key');
  await page
    .locator('#detector-sapling')
    .getByRole('button', { name: 'Save key', exact: true })
    .click();
  await expect.poll(() => keyTrigger.innerText()).toBe('Replace key');
  await page
    .locator('#detector-sapling')
    .getByRole('button', { name: 'Remove', exact: true })
    .click();
  await expect.poll(() => keyTrigger.innerText()).toBe('Add key');
  await expect.poll(() => keyTrigger.evaluate((e) => document.activeElement === e)).toBe(true);
  await page.goto(`${host.daemon.url}/settings?section=general`);
  await page.getByRole('button', { name: 'Find a setting', exact: true }).waitFor();
  await page.keyboard.press('/');
  const search = page.getByRole('dialog', { name: 'Find a setting', exact: true });
  await search.getByRole('combobox').fill('sounds');
  if (output) await page.screenshot({ path: resolve(output, 'v6-fixture-search-results.png') });
  await search.getByRole('option', { name: /Notification sounds/ }).click();
  await page.locator('[data-setting-target]').waitFor();
  if (output) await page.screenshot({ path: resolve(output, 'v6-fixture-search-target.png') });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'pitchcrew-notifications-preferences-v1')
        throw new Error('Fixture storage unavailable');
      original.call(this, key, value);
    };
  });
  const soundSwitch = page.getByRole('switch', { name: 'Notification sounds', exact: true });
  const beforeStorageFailure = await soundSwitch.boundingBox();
  await soundSwitch.click();
  await page
    .getByText(
      'Applied for this session. Device storage is unavailable; this change may not survive a restart.',
      { exact: true },
    )
    .waitFor();
  const afterStorageFailure = await soundSwitch.boundingBox();
  expect(afterStorageFailure?.y).toBe(beforeStorageFailure?.y);
  await captureSettings(page, 'v6-fixture-storage-unavailable');
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto(`${host.daemon.url}/settings?section=general`);
  await page.getByRole('combobox', { name: 'Settings section', exact: true }).waitFor();
  await captureSettings(page, 'v6-fixture-tablet-general');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${host.daemon.url}/settings?section=rules`);
  await page.getByRole('combobox', { name: 'Rule to edit', exact: true }).click();
  await page.getByRole('option', { name: /Cover letter — at most 500 words/ }).click();
  // Read its actual saved identifier instead of relying on list position or a fixed scroll offset.
  const selected = page.locator('.packet-rule-form');
  await expect.poll(() => selected.evaluate((e) => document.activeElement === e)).toBe(true);
  const box = await selected.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThan(200);
  await page.getByRole('spinbutton', { name: 'Maximum words', exact: true }).fill('');
  await page.getByText('Enter a whole number between 1 and 100,000.', { exact: true }).waitFor();
  await expect
    .poll(() => page.locator('.packet-rules-actions .ui-footer-note').innerText())
    .toBe('1 problem to fix before saving');
  expect(await page.locator('.packet-rules').innerText()).not.toContain('null');
  expect(await page.locator('.packet-rules').innerText()).not.toContain('Invalid input:');
  await expect
    .poll(() => page.getByRole('button', { name: 'Save rules', exact: true }).isDisabled())
    .toBe(true);
  await captureSettings(page, 'v6-fixture-phone-rule-error');
  await context.close();
  await host.daemon.service.jobSources.remove(source.id);
}, 60000);

test('read-only external access and a healthy service fixture show their complete workspace state', async () => {
  const output = process.env.PITCHCREW_SETTINGS_EVIDENCE;
  if (output) await mkdir(resolve(output), { recursive: true });
  expect(
    host.daemon.service.runtimeMaintenance
      .context()
      .runtimes.some((runtime) => runtime.id === 'demo'),
  ).toBe(false);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() =>
    localStorage.setItem('pitchcrew-analytics-enabled-v1', 'false'),
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await host.request('/external-mcp/access', 'PUT', { enabled: false, write: false });
  try {
    await page.goto(`${host.daemon.url}/settings?section=accounts`);
    const enabled = page.getByRole('switch', { name: 'Allow external agents', exact: true });
    const write = page.getByRole('switch', {
      name: 'Allow changes and crew messages',
      exact: true,
    });
    await expect.poll(() => enabled.isEnabled(), { timeout: 10000 }).toBe(true);
    expect(await enabled.isChecked()).toBe(false);
    expect(await write.isChecked()).toBe(false);
    await enabled.click();
    const configuration = page.getByLabel('Pitchcrew MCP configuration', { exact: true });
    await configuration.waitFor();
    const access = (await host.request<ExternalMcpInfo>('/external-mcp/access')).result;
    expect(access).toMatchObject({ enabled: true, write: false });
    expect(await write.isChecked()).toBe(false);
    expect(JSON.parse((await configuration.textContent())!)).toEqual(access.configuration);
    // Configuration carries only the command and its arguments, never credentials or an env map.
    expect(Object.keys(access.configuration.mcpServers.pitchcrew).sort()).toEqual([
      'args',
      'command',
    ]);
    expect(JSON.stringify(access.configuration)).not.toMatch(
      /--(?:credential|token|secret)|"env"\s*:/i,
    );
    await page.evaluate(() => document.fonts.ready);
    await captureSettings(page, 'v6-fixture-external-agents-on');
    await expect.poll(() => enabled.isEnabled(), { timeout: 10000 }).toBe(true);
    await enabled.click();
    await configuration.waitFor({ state: 'detached' });
    expect((await host.request<ExternalMcpInfo>('/external-mcp/access')).result).toMatchObject({
      enabled: false,
      write: false,
    });

    // Display fixture only: no service install, start, stop or other OS mutation is performed.
    const service: BackgroundServiceInfo = {
      status: {
        platform: 'windows',
        installed: true,
        enabled: true,
        running: true,
        pid: 4242,
        directory: host.directory,
        port: host.port,
        definition: 'Fixture Pitchcrew login task',
        logFile: resolve(host.directory, 'background-service', 'daemon.log'),
        detail: 'Healthy Windows service fixture for this workspace.',
      },
      startedByService: true,
      matches: true,
      customLocation: true,
      repository: process.cwd(),
      commands: {
        install: 'bun run service install',
        uninstall: 'bun run service uninstall',
        status: 'bun run service status',
        logs: 'bun run service logs',
      },
    };
    const serviceMutations: string[] = [];
    await page.route('**/api/background-service**', (route) => {
      if (route.request().method() !== 'GET') {
        serviceMutations.push(route.request().url());
        return route.abort();
      }
      return route.fulfill({ json: service });
    });
    await page.goto(`${host.daemon.url}/settings?section=data`);
    const region = page.getByRole('region', { name: 'Background service', exact: true });
    await region
      .getByText(
        'This workspace’s background service keeps routines running after you close the window.',
        {
          exact: true,
        },
      )
      .waitFor();
    expect(await region.getByText('Installed', { exact: true }).isVisible()).toBe(true);
    expect(await region.getByText('Running', { exact: true }).isVisible()).toBe(true);
    expect(
      await region.getByRole('button', { name: 'Install background service', exact: true }).count(),
    ).toBe(0);
    expect(
      await region.getByRole('button', { name: 'Use for this workspace', exact: true }).count(),
    ).toBe(0);
    await page.evaluate(() => document.fonts.ready);
    await captureSettings(page, 'v6-fixture-service-healthy');
    expect(serviceMutations).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await host.request('/external-mcp/access', 'PUT', { enabled: false, write: false });
    await context.close();
  }
}, 30000);
