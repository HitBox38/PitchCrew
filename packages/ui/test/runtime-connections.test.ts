import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  RuntimeAuthMethod,
  RuntimeAuthResponse,
  RuntimeAuthState,
  RuntimeConnectionState,
  RuntimeInfo,
  RuntimeSetupInfo,
} from '@pitchcrew/core';
import { adapters, startNativeRuntimeSignIn } from '../../adapters/src/index.ts';
import { cleanup, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let auth: RuntimeAuthState;
let methods: RuntimeAuthMethod[];
const errors: string[] = [];
const secret = 'fictional-ui-runtime-secret';
const runtime: RuntimeInfo = {
  id: 'codex',
  available: true,
  version: '1.0.0',
  detail: 'Fictional compatible installation.',
  models: [{ value: 'fixture-model', label: 'Fixture model' }],
  modelSource: 'runtime',
  modelDetail: 'Fictional model catalog.',
};
const setupInfo: RuntimeSetupInfo = {
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
const sheet = (target = page) => target.getByRole('dialog', { name: 'Set up Codex', exact: true });
const value = (target = page) => target.getByLabel('New secret value', { exact: true });
const save = (target = page) =>
  sheet(target).getByRole('button', { name: /^Save authentication settings/ });
const open = async (target = page, credentials = true) => {
  await target.goto(`${host.daemon.url}/settings?section=runtimes`);
  const row = target.getByRole('article', { name: 'Codex', exact: true });
  await row
    .or(target.getByRole('button', { name: /Add another runtime/ }))
    .first()
    .waitFor();
  if (!(await row.isVisible()))
    await target.getByRole('button', { name: /Add another runtime/ }).click();
  await row.getByRole('button', { name: /^(Manage|Set up) Codex$/ }).click();
  await sheet(target).getByRole('tab', { name: '2. Sign-in', exact: true }).click();
  if (credentials) {
    await sheet(target)
      .getByRole('button', { name: 'Credentials and provider settings', exact: true })
      .click();
    await value(target).waitFor();
  }
};
const select = async (label: string, option: string, target = page) => {
  await target.getByRole('combobox', { name: label, exact: true }).click();
  await target
    .getByRole('option', {
      name: new RegExp(`^${option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: ·.*)?$`),
    })
    .click();
};
const capture = async (name: string) => {
  const output = process.env.PITCHCREW_RUNTIME_AUTH_EVIDENCE;
  if (!output) return;
  await mkdir(resolve(output), { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === 'running' &&
          animation.effect?.getTiming().iterations !== Infinity,
      );
    await Promise.race([
      Promise.allSettled(finite.map((animation) => animation.finished)),
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ]);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  const body = page.locator('.runtime-setup-body');
  const bounds = await body.evaluate((element) => ({
    height: element.clientHeight,
    total: element.scrollHeight,
    top: element.scrollTop,
  }));
  const step = Math.max(200, bounds.height - 80);
  const parts = Math.max(1, Math.ceil((bounds.total - bounds.height) / step) + 1);
  for (let part = 0; part < parts; part++) {
    await body.evaluate(
      (element, top) => element.scrollTo({ top, behavior: 'instant' }),
      Math.min(part * step, bounds.total - bounds.height),
    );
    await page.screenshot({
      path: resolve(output, `${name}${part ? `-part${part + 1}` : ''}.png`),
    });
  }
  await body.evaluate((element, top) => element.scrollTo({ top, behavior: 'instant' }), bounds.top);
};
const waiting = (interaction: NonNullable<RuntimeAuthState['interaction']>) => {
  auth = {
    ...auth,
    id: 'fixture-flow',
    stage: 'waiting',
    detail: 'Complete this fictional authentication request.',
    interaction,
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    finishedAt: null,
  };
  return structuredClone(auth);
};

beforeAll(async () => {
  host = await setup(false, { dev: false });
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  browser = await chromium.launch({ headless: true });
}, 60000);
beforeEach(async () => {
  await rm(host.daemon.service.runtimeConnections.store.path, { force: true });
  const manager = host.daemon.service.runtimeMaintenance;
  manager.authenticationEnabled = false;
  manager.context().runtimes = [structuredClone(runtime)];
  manager.context().modelCatalogs.clear();
  manager.clearAuthentication('codex');
  vi.stubEnv('CODEX_API_KEY', 'fictional-inherited-ui-key');
  vi.spyOn(adapters.codex, 'detect').mockResolvedValue(runtime);
  vi.spyOn(adapters.codex, 'listModels').mockResolvedValue(runtime.models);
  vi.spyOn(host.daemon.service.runtimeSetup, 'info').mockResolvedValue(setupInfo);
  methods = [{ id: 'fixture-browser', label: 'Fixture browser login', kind: 'browser' }];
  auth = {
    runtime: 'codex',
    supported: true,
    id: null,
    stage: 'idle',
    detail: 'Fictional authentication only.',
    methods,
    canLogout: false,
    credentialScope: 'native',
    startedAt: null,
    expiresAt: null,
    finishedAt: null,
  };
  vi.spyOn(host.daemon.service.runtimeAuth, 'current').mockImplementation(() =>
    structuredClone(auth),
  );
  vi.spyOn(host.daemon.service.runtimeAuth, 'methods').mockImplementation(() =>
    structuredClone(methods),
  );
  errors.length = 0;
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(10000);
});
afterEach(async () => {
  await host.daemon.service.runtimeAuth.close();
  await Promise.allSettled(host.daemon.service.runtimeMaintenance.active.values());
  await page.close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  expect(errors).toEqual([]);
});
afterAll(async () => {
  await browser.close();
  await cleanup();
});

test('saves write-only credentials, reopens without echoing and distinguishes disable from inheritance', async () => {
  await open();
  expect(
    await sheet()
      .locator('.runtime-connection-field')
      .getByText(/Inherited from the daemon/)
      .isVisible(),
  ).toBe(true);
  await value().fill(secret);
  expect(await value().getAttribute('type')).toBe('password');
  expect(
    await sheet().getByRole('button', { name: 'Fixture browser login', exact: true }).isDisabled(),
  ).toBe(true);
  await save().click();
  await sheet()
    .getByText('Authentication settings saved. Recheck sign-in before starting work.', {
      exact: true,
    })
    .waitFor();
  expect(await value().inputValue()).toBe('');
  expect(
    await sheet()
      .locator('.runtime-connection-field')
      .getByText(/Saved for this runtime/)
      .isVisible(),
  ).toBe(true);
  expect(await sheet().innerText()).not.toContain(secret);
  await capture('credentials-desktop-saved');
  await sheet().getByRole('button', { name: 'Close dialog', exact: true }).click();
  await open();
  expect(await value().inputValue()).toBe('');
  await sheet().getByRole('button', { name: 'Disable for this runtime', exact: true }).click();
  await save().click();
  await sheet()
    .locator('.runtime-connection-field')
    .getByText(/Disabled for this runtime/)
    .waitFor();
  await sheet().getByRole('button', { name: 'Use daemon value', exact: true }).click();
  await save().click();
  await sheet()
    .locator('.runtime-connection-field')
    .getByText(/Inherited from the daemon/)
    .waitFor();
  expect(await value().inputValue()).toBe('');
});

test('clearing a typed secret undoes its draft while explicit disabling remains a separate choice', async () => {
  await open();
  await value().fill(secret);
  expect(await save().isDisabled()).toBe(false);
  await value().fill('');
  expect(await save().isDisabled()).toBe(true);
  expect(
    await sheet().getByRole('button', { name: 'Fixture browser login', exact: true }).isDisabled(),
  ).toBe(false);
  expect(
    await sheet()
      .getByText(/After saving, this variable will be disabled/)
      .count(),
  ).toBe(0);
  expect(await sheet().getByRole('button', { name: 'Use daemon value', exact: true }).count()).toBe(
    0,
  );
  await sheet().getByRole('button', { name: 'Disable for this runtime', exact: true }).click();
  expect(await save().isDisabled()).toBe(false);
  await sheet().getByRole('button', { name: 'Undo this change', exact: true }).click();
  expect(await save().isDisabled()).toBe(true);
  expect(
    host.daemon.service.runtimeConnections
      .status('codex')
      .fields.find((field) => field.name === 'CODEX_API_KEY')?.source,
  ).toBe('inherited');
  await sheet().getByRole('button', { name: 'Close dialog', exact: true }).click();
  expect(
    await page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true }).count(),
  ).toBe(0);
});

test('endpoint validation preserves the exact safe server guidance and both hidden and visible drafts', async () => {
  await open();
  await value().fill(secret);
  await select('Authentication variable', 'OpenAI-compatible base URL');
  const endpoint = page.getByLabel('Value', { exact: true });
  const invalid = 'https://fixture.example.test/v1?unsupported=1';
  await endpoint.fill(invalid);
  const rejected = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/runtimes/codex/connection') &&
      response.request().method() === 'PUT',
  );
  await save().click();
  expect((await rejected).status()).toBe(400);
  await sheet()
    .getByRole('alert')
    .filter({
      hasText: 'Use an HTTP or HTTPS endpoint without credentials, query parameters or a fragment.',
    })
    .waitFor();
  expect(await endpoint.inputValue()).toBe(invalid);
  expect(await save().isDisabled()).toBe(false);
  await sheet().getByRole('combobox', { name: 'Authentication variable', exact: true }).click();
  await page.getByRole('option', { name: /Codex API key · Inherited · Pending change/ }).waitFor();
  await page.getByRole('option', { name: /Codex API key · Inherited · Pending change/ }).click();
  expect(await value().inputValue()).toBe(secret);
  await sheet().getByRole('button', { name: 'Undo this change', exact: true }).click();
  expect(await value().inputValue()).toBe('');
  expect(await save().isDisabled()).toBe(false);
  await select('Authentication variable', 'OpenAI-compatible base URL');
  expect(await endpoint.inputValue()).toBe(invalid);
  await endpoint.fill('https://fixture.example.test/v1');
  await save().click();
  await sheet()
    .getByText('Authentication settings saved. Recheck sign-in before starting work.', {
      exact: true,
    })
    .waitFor();
  expect(
    host.daemon.service.runtimeConnections
      .status('codex')
      .fields.find((field) => field.name === 'CODEX_API_KEY')?.source,
  ).toBe('inherited');
});

test('clearing a saved endpoint leaves an incomplete empty edit until the user replaces or undoes it', async () => {
  const endpoint = 'https://fixture.example.test/v1';
  const service = host.daemon.service;
  await service.runtimeConnections.configure('codex', {
    revision: service.runtimeConnections.revision('codex'),
    changes: { OPENAI_BASE_URL: endpoint },
  });
  await open();
  await value().fill(secret);
  await select('Authentication variable', 'OpenAI-compatible base URL');
  const input = page.getByLabel('Value', { exact: true });
  expect(await input.inputValue()).toBe(endpoint);
  await input.fill('');
  expect(await input.inputValue()).toBe('');
  expect(await save().isDisabled()).toBe(true);
  await sheet()
    .getByText('Enter a value, undo this change, or choose Disable for this runtime.', {
      exact: true,
    })
    .waitFor();
  await capture('credentials-incomplete-endpoint-desktop');
  expect(
    await sheet()
      .getByText(/After saving, this variable will be disabled/)
      .count(),
  ).toBe(0);
  await input.blur();
  expect(await input.inputValue()).toBe('');
  await sheet().getByRole('button', { name: 'Undo this change', exact: true }).click();
  expect(await input.inputValue()).toBe(endpoint);
  expect(await save().isDisabled()).toBe(false);
  await select('Authentication variable', 'Codex API key');
  expect(await value().inputValue()).toBe(secret);
  await sheet().getByRole('button', { name: 'Undo this change', exact: true }).click();
  expect(await save().isDisabled()).toBe(true);
  await select('Authentication variable', 'OpenAI-compatible base URL');
  await input.fill('');
  expect(await input.inputValue()).toBe('');
  expect(await save().isDisabled()).toBe(true);
  await input.fill('https://replacement.example.test/v1');
  expect(await save().isDisabled()).toBe(false);
  await save().click();
  await sheet()
    .getByText('Authentication settings saved. Recheck sign-in before starting work.', {
      exact: true,
    })
    .waitFor();
  expect(
    service.runtimeConnections
      .status('codex')
      .fields.find((field) => field.name === 'OPENAI_BASE_URL'),
  ).toMatchObject({ source: 'saved', value: 'https://replacement.example.test/v1' });
});

test('invalid inherited endpoints stay hidden while users can replace them safely', async () => {
  const invalid =
    'https://fixture-user:fictional-inherited-token@fixture.example.test/v1?private=1';
  vi.stubEnv('OPENAI_BASE_URL', invalid);
  const result = await host.request<RuntimeConnectionState>('/runtimes/codex/connection');
  const field = result.result.fields.find((entry) => entry.name === 'OPENAI_BASE_URL');
  expect(field).toMatchObject({
    source: 'inherited',
    configured: true,
    invalidValue: { code: 'invalid_environment' },
  });
  expect(field).not.toHaveProperty('value');
  expect(JSON.stringify(result.result)).not.toMatch(
    /fictional-inherited-token|fixture-user|private=1/,
  );
  await open();
  await select('Authentication variable', 'OpenAI-compatible base URL');
  const input = page.getByLabel('Value', { exact: true });
  expect(await input.inputValue()).toBe('');
  await sheet()
    .getByText(/The daemon value is not valid for this setting and is hidden/)
    .waitFor();
  expect(await sheet().innerText()).not.toMatch(/fictional-inherited-token|fixture-user|private=1/);
  expect(await sheet().innerText()).not.toContain('custom provider definition..');
  expect(await save().isDisabled()).toBe(true);
  await capture('credentials-invalid-inherited-desktop');
  await input.fill('https://fixture.example.test/v1');
  await save().click();
  await sheet()
    .getByText('Authentication settings saved. Recheck sign-in before starting work.', {
      exact: true,
    })
    .waitFor();
  expect(
    host.daemon.service.runtimeConnections
      .status('codex')
      .fields.find((entry) => entry.name === 'OPENAI_BASE_URL'),
  ).toMatchObject({ source: 'saved', value: 'https://fixture.example.test/v1' });
});

test('a runtime becoming busy retains its credential draft with fixed actionable error text', async () => {
  await open();
  await value().fill(secret);
  const busy = vi
    .spyOn(host.daemon.service.runtimeMaintenance, 'busy')
    .mockReturnValue(['fictional-sensitive-busy-detail']);
  await save().click();
  await sheet()
    .getByRole('alert')
    .filter({ hasText: 'Wait for this runtime to become idle. Your draft is kept.' })
    .waitFor();
  expect(await value().inputValue()).toBe(secret);
  expect(await sheet().innerText()).not.toContain('fictional-sensitive-busy-detail');
  expect(await save().isDisabled()).toBe(false);
  busy.mockRestore();
  await save().click();
  await sheet()
    .getByText('Authentication settings saved. Recheck sign-in before starting work.', {
      exact: true,
    })
    .waitFor();
});

test('declared provider values use a shared choice control and expose saved and pending state', async () => {
  const service = host.daemon.service;
  service.runtimeMaintenance.context().runtimes = [{ ...runtime, id: 'goose' }];
  methods = [];
  auth = { ...auth, runtime: 'goose', supported: false, methods };
  vi.mocked(service.runtimeSetup.info).mockResolvedValue({ ...setupInfo, id: 'goose' });
  vi.spyOn(service.runtimeAuth, 'discoverMethods').mockResolvedValue([]);
  await page.goto(`${host.daemon.url}/settings?section=runtimes`);
  await page
    .getByRole('article', { name: 'Goose', exact: true })
    .getByRole('button', { name: 'Manage Goose', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Set up Goose', exact: true });
  await dialog.getByRole('tab', { name: '2. Sign-in', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Credentials and provider settings', exact: true })
    .click();
  await select('Authentication variable', 'Default provider');
  const choice = page.getByRole('combobox', { name: 'Value for GOOSE_PROVIDER', exact: true });
  await choice.waitFor();
  expect(await page.getByLabel('Value', { exact: true }).count()).toBe(0);
  await select('Value for GOOSE_PROVIDER', 'anthropic');
  await dialog.getByRole('combobox', { name: 'Authentication variable', exact: true }).click();
  await page
    .getByRole('option', {
      name: 'Default provider · Not configured · Pending change',
      exact: true,
    })
    .click();
  await dialog.getByRole('button', { name: /^Save authentication settings/ }).click();
  await dialog
    .getByText('Authentication settings saved. Recheck sign-in before starting work.', {
      exact: true,
    })
    .waitFor();
  expect(
    service.runtimeConnections
      .status('goose')
      .fields.find((field) => field.name === 'GOOSE_PROVIDER'),
  ).toMatchObject({ value: 'anthropic', source: 'saved' });
  await dialog.getByRole('combobox', { name: 'Authentication variable', exact: true }).click();
  await page.getByRole('option', { name: 'Default provider · Saved', exact: true }).click();
  await capture('credentials-provider-choice-desktop');
});

test('failed saves preserve drafts across steps and the unsaved-close guard; pending saves disable close', async () => {
  await page.route('**/api/runtimes/codex/connection', (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({ status: 503, json: { error: 'Fictional storage failure.' } })
      : route.continue(),
  );
  await open();
  await value().fill(secret);
  await save().click();
  await sheet().getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor();
  expect(await value().inputValue()).toBe(secret);
  expect(
    await sheet()
      .getByText(/Authentication settings saved/)
      .count(),
  ).toBe(0);
  await sheet().getByRole('tab', { name: '3. Models', exact: true }).click();
  await sheet().getByRole('tab', { name: '2. Sign-in', exact: true }).click();
  expect(await value().inputValue()).toBe(secret);
  await sheet().getByRole('button', { name: 'Close dialog', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  await discard.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect(await value().inputValue()).toBe(secret);
  await page.unroute('**/api/runtimes/codex/connection');
  let release!: () => void, markPosted!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const posted = new Promise<void>((resolve) => {
    markPosted = resolve;
  });
  await page.route('**/api/runtimes/codex/connection', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    markPosted();
    await hold;
    return route.continue();
  });
  await save().click();
  await posted;
  expect(
    await sheet().getByRole('button', { name: 'Close dialog', exact: true }).isDisabled(),
  ).toBe(true);
  expect(await sheet().getByRole('button', { name: 'Saving…', exact: true }).isDisabled()).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  expect(await sheet().isVisible()).toBe(true);
  release();
  await sheet()
    .getByText('Authentication settings saved. Recheck sign-in before starting work.', {
      exact: true,
    })
    .waitFor();
  expect(await value().inputValue()).toBe('');
});

test('a stale second window keeps its draft and the other window’s saved settings', async () => {
  await open();
  await value().fill(secret);
  const other = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  try {
    await open(other);
    await select('Authentication variable', 'OpenAI-compatible base URL', other);
    await other
      .getByLabel('Value', { exact: true })
      .fill('https://fixture-other-window.example.test/v1');
    await save(other).click();
    await sheet(other)
      .getByText('Authentication settings saved. Recheck sign-in before starting work.', {
        exact: true,
      })
      .waitFor();
    await save().click();
    await sheet().getByRole('alert').filter({ hasText: 'changed in another window' }).waitFor();
    expect(await value().inputValue()).toBe(secret);
    await select('Authentication variable', 'OpenAI-compatible base URL');
    expect(await page.getByLabel('Value', { exact: true }).inputValue()).toBe(
      'https://fixture-other-window.example.test/v1',
    );
    await select('Authentication variable', 'Codex API key');
    expect(await value().inputValue()).toBe(secret);
    await save().click();
    await sheet()
      .getByText('Authentication settings saved. Recheck sign-in before starting work.', {
        exact: true,
      })
      .waitFor();
    expect(
      host.daemon.service.runtimeConnections
        .status('codex')
        .fields.find((field) => field.name === 'OPENAI_BASE_URL')?.value,
    ).toBe('https://fixture-other-window.example.test/v1');
  } finally {
    await other.close();
  }
});

test('an acknowledged credential save survives a failed workspace refresh without keeping a saved draft', async () => {
  let committed = false;
  const configure = host.daemon.service.runtimeConnections.configure;
  vi.spyOn(host.daemon.service.runtimeConnections, 'configure').mockImplementation(
    async (id, input) => {
      const result = await configure(id, input);
      committed = true;
      return result;
    },
  );
  await page.route('**/api/snapshot?view=workspace', (route) =>
    committed
      ? route.fulfill({ status: 503, json: { error: 'Fictional refresh failure.' } })
      : route.continue(),
  );
  await open();
  await value().fill(secret);
  await save().click();
  await sheet()
    .getByRole('alert')
    .filter({
      hasText: /^Settings were saved, but account status could not refresh\. Recheck sign-in\.$/,
    })
    .waitFor();
  expect(await value().inputValue()).toBe('');
  expect(await save().isDisabled()).toBe(true);
  await sheet().getByRole('button', { name: 'Close dialog', exact: true }).click();
  expect(
    await page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true }).count(),
  ).toBe(0);
});

test('method selection renders device and code requests with exact flow and interaction identities', async () => {
  methods = [
    { id: 'fixture-device', label: 'Fixture device login', kind: 'device' },
    { id: 'fixture-code', label: 'Fixture code login', kind: 'code' },
  ];
  const start = vi
    .spyOn(host.daemon.service.runtimeAuth, 'start')
    .mockImplementation((_id, method) =>
      method === 'fixture-device'
        ? waiting({
            id: 'fixture-device-request',
            type: 'device',
            url: 'https://auth.openai.com/authorize?fixture=1',
            userCode: 'FAKE-1234',
          })
        : waiting({ id: 'fixture-code-request', type: 'code', label: 'Fixture one-time code' }),
    );
  vi.spyOn(host.daemon.service.runtimeAuth, 'cancel').mockImplementation(async () => {
    auth = {
      ...auth,
      stage: 'cancelled',
      detail: 'Fictional sign-in cancelled.',
      interaction: undefined,
      finishedAt: new Date().toISOString(),
    };
    return structuredClone(auth);
  });
  const respond = vi
    .spyOn(host.daemon.service.runtimeAuth, 'respondInteraction')
    .mockImplementation(() => {
      auth = {
        ...auth,
        stage: 'completed',
        detail: 'Sign-in finished, but native readiness is still unverified.',
        interaction: undefined,
        finishedAt: new Date().toISOString(),
      };
      return structuredClone(auth);
    });
  await open(page, false);
  await sheet().getByRole('button', { name: 'Fixture device login', exact: true }).click();
  await sheet().getByText('FAKE-1234', { exact: true }).waitFor();
  expect(start).toHaveBeenLastCalledWith('codex', 'fixture-device');
  expect(
    await sheet()
      .getByRole('link', { name: 'Open sign-in page', exact: true })
      .getAttribute('href'),
  ).toBe('https://auth.openai.com/authorize?fixture=1');
  await sheet().getByRole('button', { name: 'Cancel sign-in', exact: true }).click();
  await select('Sign-in method', 'Fixture code login');
  await sheet().getByRole('button', { name: 'Retry sign-in', exact: true }).click();
  await page.getByLabel('Fixture one-time code', { exact: true }).fill('fictional-one-time-code');
  await sheet().getByRole('button', { name: 'Continue sign-in', exact: true }).click();
  expect(respond).toHaveBeenLastCalledWith('codex', 'fixture-flow', 'fixture-code-request', {
    type: 'code',
    code: 'fictional-one-time-code',
  });
  await sheet()
    .getByText('Sign-in finished, but native readiness is still unverified.', { exact: true })
    .waitFor();
  expect(
    await sheet().getByRole('tab', { name: '2. Sign-in', exact: true }).innerText(),
  ).not.toContain('Signed in');
  await capture('authentication-completed-unverified');
  expect(
    await sheet()
      .getByRole('button', { name: 'Recheck sign-in', exact: true })
      .getAttribute('data-variant'),
  ).toBe('default');
  expect(await sheet().locator('#runtime-auth-start').getAttribute('data-variant')).toBe('outline');
});

test('generic credential prompts submit only their active request fields and clear acknowledged values', async () => {
  methods = [{ id: 'fixture-credentials', label: 'Fixture credential login', kind: 'credentials' }];
  vi.spyOn(host.daemon.service.runtimeAuth, 'start').mockImplementation(() =>
    waiting({
      id: 'fixture-credentials-request',
      type: 'credentials',
      fields: [
        { name: 'account', label: 'Fixture account name', secret: false },
        { name: 'token', label: 'Fixture temporary token', secret: true },
      ],
    }),
  );
  const respond = vi
    .spyOn(host.daemon.service.runtimeAuth, 'respondInteraction')
    .mockImplementation(() => {
      auth = {
        ...auth,
        stage: 'verifying',
        detail: 'Verifying fictional native readiness.',
        interaction: undefined,
      };
      return structuredClone(auth);
    });
  await open(page, false);
  await sheet().getByRole('button', { name: 'Fixture credential login', exact: true }).click();
  await page.getByLabel('Fixture account name', { exact: true }).fill('fictional-account');
  await page.getByLabel('Fixture temporary token', { exact: true }).fill('fictional-private-token');
  expect(
    await page.getByLabel('Fixture temporary token', { exact: true }).getAttribute('type'),
  ).toBe('password');
  await sheet().getByRole('button', { name: 'Continue sign-in', exact: true }).click();
  expect(respond).toHaveBeenLastCalledWith('codex', 'fixture-flow', 'fixture-credentials-request', {
    type: 'credentials',
    values: { account: 'fictional-account', token: 'fictional-private-token' },
  });
  await sheet().getByText('Verifying fictional native readiness.', { exact: true }).waitFor();
  expect(await page.getByLabel('Fixture temporary token', { exact: true }).count()).toBe(0);
  expect(JSON.stringify((await host.request('/snapshot')).result)).not.toContain(
    'fictional-private-token',
  );
});

test('desktop browser consent opens exactly the real URL after acknowledgement and never creates a blank popup', async () => {
  const url = 'https://auth.openai.com/authorize?fixture=consent';
  vi.spyOn(host.daemon.service.runtimeAuth, 'start').mockImplementation(() =>
    waiting({
      id: 'fixture-browser-consent',
      type: 'browser',
      url,
      requiresConsent: true,
    }),
  );
  const respond = vi
    .spyOn(host.daemon.service.runtimeAuth, 'respondInteraction')
    .mockImplementation(() => {
      if (auth.interaction?.type === 'browser') auth.interaction.requiresConsent = false;
      return structuredClone(auth);
    });
  await open(page, false);
  await page.evaluate(() => {
    const fixture = window as unknown as { openedAuthenticationUrls: string[] };
    fixture.openedAuthenticationUrls = [];
    Object.assign(window, {
      pitchcrewBrowser: { identify: async () => 'fictional-desktop-owner' },
    });
    window.open = ((url) => {
      fixture.openedAuthenticationUrls.push(String(url));
      return null;
    }) as typeof window.open;
  });
  await sheet().getByRole('button', { name: 'Fixture browser login', exact: true }).click();
  await sheet().getByRole('button', { name: 'Open sign-in page', exact: true }).waitFor();
  await capture('native-signin-browser-consent-desktop');
  let release!: () => void, markPosted!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const posted = new Promise<void>((resolve) => {
    markPosted = resolve;
  });
  await page.route('**/api/runtimes/codex/auth/respond', async (route) => {
    markPosted();
    await held;
    return route.continue();
  });
  await sheet().getByRole('button', { name: 'Open sign-in page', exact: true }).click();
  await posted;
  const opened = () =>
    page.evaluate(
      () => (window as unknown as { openedAuthenticationUrls: string[] }).openedAuthenticationUrls,
    );
  expect(await opened()).toEqual([]);
  expect(respond).not.toHaveBeenCalled();
  release();
  await expect.poll(opened).toEqual([url]);
  await sheet()
    .getByText('Sign-in page requested. Complete sign-in in your browser, then return here.', {
      exact: true,
    })
    .waitFor();
  const requested = sheet().getByText(
    'Sign-in page requested. Complete sign-in in your browser, then return here.',
    { exact: true },
  );
  expect(
    await requested.evaluate((element) => element.closest('.settings-row-actions') === null),
  ).toBe(true);
  const requestedBounds = await requested.boundingBox();
  const actionBounds = await sheet()
    .getByRole('link', { name: 'Open sign-in page again', exact: true })
    .evaluate((element) => element.closest('.settings-row-actions')!.getBoundingClientRect().top);
  expect(requestedBounds!.y + requestedBounds!.height).toBeLessThanOrEqual(actionBounds + 1);
  expect(
    await sheet()
      .getByRole('link', { name: 'Open sign-in page again', exact: true })
      .getAttribute('data-variant'),
  ).toBe('outline');
  expect(respond).toHaveBeenCalledWith('codex', 'fixture-flow', 'fixture-browser-consent', {
    type: 'browser',
    action: 'open',
  });
  expect(await page.getByText(/blocked.*link|unsupported.protocol/i).count()).toBe(0);
  await capture('native-signin-browser-consent-acknowledged');
});

test('the real VT browser surface serializes input, sends bounded resize and cancels the exact flow', async () => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  methods = [{ id: 'fixture-terminal', label: 'Fixture terminal login', kind: 'terminal' }];
  const transcript =
    '\u001b[33mDevice code: FAKE-1234\u001b[0m\r\n\u001b[37mSign in at https://auth.openai.com/activate?fixture=1\u001b[0m\r\n\u001b[90mFictional private authentication terminal\u001b[0m\r\nhttps://example.invalid/untrusted\r\n';
  vi.spyOn(host.daemon.service.runtimeAuth, 'start').mockImplementation(() =>
    waiting({
      id: 'fixture-terminal-request',
      type: 'terminal',
      output: transcript,
      outputOffset: transcript.length,
    }),
  );
  const cancel = vi
    .spyOn(host.daemon.service.runtimeAuth, 'cancel')
    .mockImplementation(async () => {
      auth = {
        ...auth,
        stage: 'cancelled',
        detail: 'Fictional terminal cancelled.',
        interaction: undefined,
        finishedAt: new Date().toISOString(),
      };
      return structuredClone(auth);
    });
  const received: {
    flowId: string;
    interactionId: string;
    response: Extract<RuntimeAuthResponse, { type: 'terminal' }>;
  }[] = [];
  let release!: () => void, markFirst!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = new Promise<void>((resolve) => {
    markFirst = resolve;
  });
  await page.route('**/api/runtimes/codex/auth/respond', async (route) => {
    const body = route.request().postDataJSON() as (typeof received)[number];
    received.push(body);
    if (body.response.data === 'a') {
      markFirst();
      await hold;
    }
    return route.fulfill({ status: 200, json: auth });
  });
  await open(page, false);
  await sheet().getByRole('button', { name: 'Fixture terminal login', exact: true }).click();
  const terminal = sheet().getByRole('region', { name: 'Runtime sign-in terminal', exact: true });
  const link = sheet().getByRole('link', { name: 'Open auth.openai.com sign-in', exact: true });
  expect(await link.getAttribute('href')).toBe('https://auth.openai.com/activate?fixture=1');
  expect(
    await sheet()
      .getByRole('link', { name: /example.invalid/ })
      .count(),
  ).toBe(0);
  await sheet().getByRole('button', { name: 'Copy code FAKE-1234', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('FAKE-1234');
  const feedback = sheet().getByText('Copied. Sign-in is still waiting.', { exact: true });
  await feedback.waitFor();
  await expect.poll(() => feedback.count(), { timeout: 5000 }).toBe(0);
  expect(await terminal.evaluate((element) => element.getBoundingClientRect().height)).toBe(200);
  await sheet().getByRole('button', { name: 'Copy terminal text', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    'https://auth.openai.com/activate?fixture=1',
  );
  const screen = await terminal.locator('.xterm-screen').boundingBox();
  expect(screen).not.toBeNull();
  await page.mouse.move(screen!.x + 2, screen!.y + 8);
  await page.mouse.down();
  await page.mouse.move(screen!.x + 185, screen!.y + 8, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => terminal.locator('.xterm-selection div').count()).toBeGreaterThan(0);
  await page.evaluate(() => navigator.clipboard.writeText('fictional clipboard sentinel'));
  await page.keyboard.press('Control+c');
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('Device code: FAKE-1234');
  expect(received.some((body) => body.response.data.includes('\u0003'))).toBe(false);
  await page.mouse.click(screen!.x + 280, screen!.y + 45);
  await terminal.locator('.xterm-helper-textarea').focus();
  await page.keyboard.type('a');
  await first;
  await page.keyboard.type('b');
  expect(received.filter((body) => body.response.data).map((body) => body.response.data)).toEqual([
    'a',
  ]);
  release();
  await expect
    .poll(() =>
      received
        .filter((body) => body.response.data)
        .map((body) => body.response.data)
        .join(''),
    )
    .toBe('ab');
  const resize = received.find((body) => body.response.size)?.response.size;
  expect(resize?.cols).toBeGreaterThan(0);
  expect(resize?.rows).toBeGreaterThan(0);
  expect(
    received.every(
      (body) => body.flowId === 'fixture-flow' && body.interactionId === 'fixture-terminal-request',
    ),
  ).toBe(true);
  await capture('native-signin-terminal-desktop');
  await sheet().getByRole('button', { name: 'Cancel sign-in', exact: true }).click();
  // A completed click does not await the cancellation HTTP request.
  await sheet().getByText('Fictional terminal cancelled.', { exact: true }).waitFor();
  expect(cancel).toHaveBeenCalledWith('codex', 'fixture-flow');
  expect(await terminal.count()).toBe(0);
});

test('terminal copy and sign-in actions describe the current redrawn screen without obsolete TUI frames', async () => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  methods = [{ id: 'fixture-terminal', label: 'Fixture terminal login', kind: 'terminal' }];
  const transcript =
    '\u001b[31mOld chooser frame: NOT-CURRENT\u001b[0m\r\nhttps://auth.openai.com/obsolete\r\nDevice code: OLDD-0000\r\n\u001b[2J\u001b[H\u001b(BLoading provider...\r\u001b[2K\u001b[37mCurrent provider: OpenAI\u001b[0m\r\nDevice code: LIVE-1234\r\nhttps://auth.openai.com/activate?fixture=redraw\r\n';
  vi.spyOn(host.daemon.service.runtimeAuth, 'start').mockImplementation(() =>
    waiting({
      id: 'fixture-terminal-redraw',
      type: 'terminal',
      output: transcript,
      outputOffset: transcript.length,
    }),
  );
  vi.spyOn(host.daemon.service.runtimeAuth, 'respondInteraction').mockImplementation(() =>
    structuredClone(auth),
  );
  await open(page, false);
  await sheet().getByRole('button', { name: 'Fixture terminal login', exact: true }).click();
  const terminal = sheet().getByRole('region', { name: 'Runtime sign-in terminal', exact: true });
  await expect
    .poll(() => terminal.locator('.xterm-accessibility-tree').innerText(), { timeout: 8000 })
    .toContain('Current provider: OpenAI');
  const link = sheet().getByRole('link', { name: 'Open auth.openai.com sign-in', exact: true });
  expect(await link.getAttribute('href')).toBe('https://auth.openai.com/activate?fixture=redraw');
  expect(
    await sheet().getByRole('button', { name: 'Copy code OLDD-0000', exact: true }).count(),
  ).toBe(0);
  await sheet().getByRole('button', { name: 'Copy code LIVE-1234', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('LIVE-1234');
  await sheet().getByRole('button', { name: 'Copy terminal text', exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Current provider: OpenAI');
  expect(copied).toContain('Device code: LIVE-1234');
  expect(copied).toContain('https://auth.openai.com/activate?fixture=redraw');
  expect(copied).not.toMatch(/NOT-CURRENT|Old chooser|Loading provider|obsolete|OLDD-0000/);
  expect(copied.includes('\u001b')).toBe(false);
  await capture('native-signin-terminal-redraw-desktop');
});

test('sign-out requires an explicit scope-aware decision and never clears conversation history', async () => {
  auth.canLogout = true;
  const before = JSON.stringify(host.daemon.service.board.list('conversation'));
  const logout = vi.spyOn(host.daemon.service.runtimeAuth, 'logout').mockImplementation(() => {
    auth = {
      ...auth,
      id: 'fixture-logout',
      operation: 'logout',
      stage: 'succeeded',
      detail: 'Native sign-out completed. Saved conversation history is kept.',
      finishedAt: new Date().toISOString(),
    };
    return structuredClone(auth);
  });
  await open(page, false);
  await sheet().getByRole('button', { name: 'Sign out', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Sign out of Codex?', exact: true });
  await confirmation.getByText(/outside Pitchcrew/).waitFor();
  await capture('native-signout-confirmation-desktop');
  expect(await page.locator('[data-slot="dialog-overlay"]:visible').count()).toBe(2);
  const backdrop = page.locator('[data-slot="dialog-overlay"]:visible').last();
  await expect
    .poll(() => backdrop.evaluate((element) => Number(getComputedStyle(element).opacity)))
    .toBeGreaterThan(0.95);
  expect(await backdrop.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
    'rgba(0, 0, 0, 0)',
  );
  const spacing = await confirmation.locator('[data-slot="dialog-header"]').evaluate((element) => {
    const title = element.querySelector('[data-slot="dialog-title"]')!.getBoundingClientRect();
    const description = element
      .querySelector('[data-slot="dialog-description"]')!
      .getBoundingClientRect();
    return description.top - title.bottom;
  });
  expect(spacing).toBeGreaterThanOrEqual(7.5);
  await confirmation.getByRole('button', { name: 'Keep account', exact: true }).click();
  expect(logout).not.toHaveBeenCalled();
  logout.mockImplementationOnce(() => {
    throw new Error('Fictional sign-out was refused.');
  });
  await sheet().getByRole('button', { name: 'Sign out', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Sign out', exact: true }).click();
  await confirmation.getByRole('alert').filter({ hasText: 'Sign-out could not start' }).waitFor();
  expect(await confirmation.isVisible()).toBe(true);
  expect(auth.stage).toBe('idle');
  expect(JSON.stringify(host.daemon.service.board.list('conversation'))).toBe(before);
  await confirmation.getByRole('button', { name: 'Keep account', exact: true }).click();
  await sheet().getByRole('alert').filter({ hasText: 'Fictional sign-out was refused.' }).waitFor();
  await sheet().getByRole('button', { name: 'Sign out', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Sign out', exact: true }).click();
  await confirmation.waitFor({ state: 'detached' });
  expect(logout).toHaveBeenCalledWith('codex');
  await sheet()
    .getByText('Native sign-out completed. Saved conversation history is kept.', { exact: true })
    .waitFor();
  expect(
    await sheet()
      .getByText(/previous sign-in finished/)
      .count(),
  ).toBe(0);
  expect(JSON.stringify(host.daemon.service.board.list('conversation'))).toBe(before);
});

test('a real Node PTY auth-only fixture reaches the VT browser surface and completes without asserting readiness', async () => {
  const service = host.daemon.service;
  const manager = service.runtimeMaintenance;
  const native = service.runtimeAuth;
  const opencode: RuntimeInfo = { ...runtime, id: 'opencode' };
  manager.context().runtimes = [opencode];
  manager.authenticationEnabled = true;
  vi.stubEnv('OPENAI_API_KEY', 'fictional-real-pty-test-key');
  vi.mocked(native.current).mockRestore();
  vi.mocked(native.methods).mockRestore();
  vi.mocked(service.runtimeSetup.info).mockResolvedValue({ ...setupInfo, id: 'opencode' });
  vi.spyOn(adapters.opencode, 'detect').mockResolvedValue(opencode);
  vi.spyOn(adapters.opencode, 'listModels').mockResolvedValue(opencode.models);
  vi.spyOn(native.host, 'executable').mockResolvedValue(process.execPath);
  vi.spyOn(native.host, 'detect').mockResolvedValue(opencode);
  vi.spyOn(manager.host, 'authenticate').mockResolvedValue({
    status: 'unknown',
    checkedAt: new Date().toISOString(),
    detail: 'Fictional CLI finished; account readiness remains unverified.',
    instructions: 'Recheck the account.',
  });
  const fixture = fileURLToPath(
    new URL('../../adapters/test/fixtures/runtime-auth-native.mjs', import.meta.url),
  );
  const start = vi.spyOn(native.host, 'start').mockImplementation((runtimeId, options) =>
    startNativeRuntimeSignIn(runtimeId, {
      ...options,
      command: process.execPath,
      prefix: [fixture, 'opencode'],
      timeout: 20000,
    }),
  );
  const observed: { stage: string; offset?: number; prompt: boolean }[] = [];
  page.on('response', async (response) => {
    if (!response.url().endsWith('/api/runtimes/opencode/auth')) return;
    const state = (await response.json()) as RuntimeAuthState;
    const interaction = state.interaction;
    observed.push({
      stage: state.stage,
      offset: interaction?.type === 'terminal' ? interaction.outputOffset : undefined,
      prompt:
        interaction?.type === 'terminal' &&
        interaction.output.includes('Fictional auth-only terminal'),
    });
  });
  await page.goto(`${host.daemon.url}/settings?section=runtimes`);
  await page
    .getByRole('article', { name: 'OpenCode', exact: true })
    .getByRole('button', { name: 'Manage OpenCode', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Set up OpenCode', exact: true });
  await dialog.getByRole('tab', { name: '2. Sign-in', exact: true }).click();
  await dialog.locator('#runtime-auth-start').click();
  const terminal = dialog.getByRole('region', { name: 'Runtime sign-in terminal', exact: true });
  await terminal.waitFor();
  await expect
    .poll(
      () => {
        const interaction = native.current('opencode').interaction;
        return interaction?.type === 'terminal' ? interaction.output : '';
      },
      { timeout: 8000 },
    )
    .toContain('Fictional auth-only terminal');
  const output = native.current('opencode').interaction;
  expect(output?.type).toBe('terminal');
  if (output?.type === 'terminal') {
    expect(output.output).toContain('Fictional auth-only terminal');
    expect(output.outputOffset).toBe(output.output.length);
    expect(output.output).not.toContain('fictional-real-pty-test-key');
  }
  const served = await host.request<RuntimeAuthState>('/runtimes/opencode/auth');
  expect(served.result.interaction?.type).toBe('terminal');
  if (served.result.interaction?.type === 'terminal')
    expect(served.result.interaction.output).toContain('Fictional auth-only terminal');
  await expect
    .poll(() => dialog.getByRole('button', { name: 'Close dialog', exact: true }).isDisabled())
    .toBe(false);
  await expect
    .poll(() => observed, { timeout: 8000 })
    .toEqual(expect.arrayContaining([expect.objectContaining({ prompt: true })]));
  await expect
    .poll(async () => ({
      shown: await terminal.locator('.xterm-accessibility-tree').innerText(),
      responses: observed,
    }))
    .toMatchObject({ shown: expect.stringContaining('Fictional auth-only terminal') });
  expect(start).toHaveBeenCalledOnce();
  await capture('native-signin-real-pty-desktop');
  await terminal.locator('.xterm-helper-textarea').focus();
  await page.keyboard.type('fixture-response');
  await page.keyboard.press('Enter');
  await expect.poll(() => native.current('opencode').stage).toBe('completed');
  await dialog.getByText(native.current('opencode').detail, { exact: true }).waitFor();
  expect(await terminal.count()).toBe(0);
  expect(await dialog.getByText('Your account is connected', { exact: true }).count()).toBe(0);
}, 30000);

test('workspace sign-out names Grok and explains when the configured API key takes over', async () => {
  const service = host.daemon.service;
  service.runtimeMaintenance.context().runtimes = [{ ...runtime, id: 'grok' }];
  auth = { ...auth, runtime: 'grok', canLogout: true, credentialScope: 'workspace' };
  vi.mocked(service.runtimeSetup.info).mockResolvedValue({ ...setupInfo, id: 'grok' });
  vi.spyOn(service.runtimeAuth, 'discoverMethods').mockResolvedValue(methods);
  const logout = vi.spyOn(service.runtimeAuth, 'logout').mockImplementation(() => {
    throw new Error('Fictional scope confirmation must not start sign-out.');
  });
  await page.goto(`${host.daemon.url}/settings?section=runtimes`);
  await page
    .getByRole('article', { name: 'Grok Build', exact: true })
    .getByRole('button', { name: 'Manage Grok Build', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Set up Grok Build', exact: true });
  await dialog.getByRole('tab', { name: '2. Sign-in', exact: true }).click();
  await dialog.getByRole('button', { name: 'Sign out', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Sign out of Grok Build?', exact: true });
  await confirmation.getByText(/Pitchcrew workspace/).waitFor();
  expect(await confirmation.innerText()).toContain('A configured API key will apply again.');
  expect(await confirmation.innerText()).not.toContain('outside Pitchcrew');
  await capture('native-signout-workspace-confirmation-desktop');
  await confirmation.getByRole('button', { name: 'Keep account', exact: true }).click();
  expect(logout).not.toHaveBeenCalled();
});

test('damaged authentication remains usable and recovers every runtime only after confirmation with a private exact backup', async () => {
  const service = host.daemon.service;
  const connections = service.runtimeConnections;
  const manager = service.runtimeMaintenance;
  await connections.configure('codex', {
    revision: connections.revision('codex'),
    changes: { CODEX_API_KEY: secret },
  });
  await connections.configure('opencode', {
    revision: connections.revision('opencode'),
    changes: { OPENAI_API_KEY: 'fictional-recovery-ui-opencode-secret' },
  });
  const nativePath = join(await connections.authenticationDirectory('grok'), 'auth.json');
  const nativeBytes = '{"fixture":"fictional-retained-native-grok-token"}';
  await writeFile(nativePath, nativeBytes, { mode: 0o600 });
  const bytes = (await readFile(connections.store.path, 'utf8')) + '\nfictional damaged suffix';
  await writeFile(connections.store.path, bytes, { mode: 0o600 });
  for (const adapter of Object.values(adapters)) {
    if (adapter.id !== 'demo')
      vi.spyOn(adapter, 'detect').mockResolvedValue({ ...runtime, id: adapter.id });
  }
  vi.mocked(service.runtimeAuth.current).mockRestore();
  const nativeStart = vi.spyOn(service.runtimeAuth.host, 'start').mockImplementation(() => {
    throw new Error('Fictional recovery test must not start native authentication.');
  });
  await manager.context().detect();
  expect(service.runtimes.find((entry) => entry.id === 'codex')?.available).toBe(false);
  expect(service.runtimes.find((entry) => entry.id === 'codex')?.configurationError).toMatchObject({
    code: 'credentials_unreadable',
    installationAvailable: true,
  });
  await page.goto(`${host.daemon.url}/settings?section=runtimes`);
  const row = page.getByRole('article', { name: 'Codex', exact: true });
  await row.getByRole('button', { name: 'Manage Codex', exact: true }).click();
  expect(
    await sheet()
      .getByRole('tab', { name: '2. Sign-in', exact: true })
      .getAttribute('aria-selected'),
  ).toBe('true');
  expect(
    await sheet().getByRole('tab', { name: '1. Installation', exact: true }).innerText(),
  ).toContain('Ready');
  expect(await sheet().getByRole('tab', { name: '2. Sign-in', exact: true }).innerText()).toContain(
    'Recover settings',
  );
  expect(await sheet().innerText()).not.toMatch(
    /Install first|Finish installing a compatible runtime/,
  );
  const recover = sheet().getByRole('button', {
    name: 'Recover authentication settings',
    exact: true,
  });
  await recover.waitFor();
  expect(await recover.getAttribute('data-variant')).toBe('default');
  expect(await value().count()).toBe(0);
  expect(await save().count()).toBe(0);
  expect(await sheet().innerText()).not.toContain(secret);
  expect(await sheet().locator('#runtime-auth-start').count()).toBe(0);
  await capture('authentication-settings-unreadable');
  await recover.click();
  const confirmation = page.getByRole('dialog', {
    name: 'Reset saved authentication settings?',
    exact: true,
  });
  await confirmation.getByText(/all runtimes/).waitFor();
  expect(await confirmation.innerText()).toContain('The backup contains secrets');
  expect(await confirmation.innerText()).toContain('Daemon environment values will apply again.');
  expect(await confirmation.innerText()).toContain(
    'Native CLI accounts and managed sign-ins are kept',
  );
  await confirmation.getByRole('button', { name: 'Keep settings', exact: true }).click();
  await confirmation.waitFor({ state: 'detached' });
  expect(await readFile(connections.store.path, 'utf8')).toBe(bytes);
  await recover.click();
  const acknowledged = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/runtimes/codex/connection/recover') &&
      response.request().method() === 'POST',
  );
  await confirmation
    .getByRole('button', { name: 'Reset authentication settings', exact: true })
    .click();
  const response = await acknowledged;
  expect(response.status()).toBe(200);
  const recovered = (await response.json()) as RuntimeConnectionState & { backup: string };
  expect(recovered.backup).toMatch(/^credentials\.invalid-[a-f0-9-]{36}\.json$/);
  const backup = join(connections.store.folder, recovered.backup);
  expect(dirname(backup)).toBe(connections.store.folder);
  expect(await readFile(backup, 'utf8')).toBe(bytes);
  expect(await readFile(nativePath, 'utf8')).toBe(nativeBytes);
  await confirmation.waitFor({ state: 'detached' });
  await value().waitFor();
  await sheet()
    .getByText(
      `Authentication settings reset. Backup kept as ${recovered.backup}. Daemon environment values apply again. Recheck sign-in before starting work.`,
      { exact: true },
    )
    .waitFor();
  expect(await value().inputValue()).toBe('');
  await sheet()
    .locator('.runtime-connection-field')
    .getByText(/Inherited from the daemon/)
    .waitFor();
  expect(
    connections.status('opencode').fields.find((field) => field.name === 'OPENAI_API_KEY')?.source,
  ).not.toBe('saved');
  expect(service.runtimes.find((entry) => entry.id === 'codex')?.available).toBe(true);
  expect(nativeStart).not.toHaveBeenCalled();
  await capture('authentication-settings-recovered');
  await sheet().getByRole('tab', { name: '1. Installation', exact: true }).click();
  await sheet().getByText('Ready', { exact: true }).waitFor();
});

test('credentials recovery expands a previously loaded and collapsed editor when a later status becomes unreadable', async () => {
  const service = host.daemon.service;
  vi.spyOn(service.runtimeAuth, 'discoverMethods')
    .mockRejectedValueOnce(new Error('Fictional method lookup failed.'))
    .mockResolvedValue(methods);
  await open();
  const disclosure = sheet().getByRole('button', {
    name: 'Credentials and provider settings',
    exact: true,
  });
  await disclosure.click();
  expect(await disclosure.getAttribute('aria-expanded')).toBe('false');
  const retry = sheet().getByRole('button', { name: 'Retry sign-in methods', exact: true });
  await retry.waitFor();
  await mkdir(dirname(service.runtimeConnections.store.path), { recursive: true });
  await writeFile(
    service.runtimeConnections.store.path,
    'fictional damaged authentication settings',
    { mode: 0o600 },
  );
  vi.mocked(service.runtimeAuth.current).mockRestore();
  await retry.click();
  await sheet()
    .getByRole('button', { name: 'Recover authentication settings', exact: true })
    .waitFor();
  expect(await disclosure.getAttribute('aria-expanded')).toBe('true');
  expect(await value().count()).toBe(0);
  expect(await save().count()).toBe(0);
  expect(await sheet().locator('#runtime-auth-start').count()).toBe(0);
});

test('phone dark credentials remain masked with usable touch targets and honest unverified state', async () => {
  await page.close();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  auth = {
    ...auth,
    stage: 'completed',
    detail: 'Native sign-in finished; account readiness remains unverified.',
    finishedAt: new Date().toISOString(),
  };
  methods = [{ id: 'fixture-terminal', label: 'Fixture terminal login', kind: 'terminal' }];
  vi.spyOn(host.daemon.service.runtimeAuth, 'start').mockImplementation(() =>
    waiting({
      id: 'fixture-phone-terminal',
      type: 'terminal',
      output:
        '\u001b[33mDevice code: FAKE-1234\u001b[0m\r\n\u001b[37mhttps://auth.openai.com/activate?fixture=phone\u001b[0m\r\n\u001b[90mComplete native sign-in to continue.\u001b[0m\r\n',
    }),
  );
  const respond = vi
    .spyOn(host.daemon.service.runtimeAuth, 'respondInteraction')
    .mockImplementation(() => structuredClone(auth));
  await open();
  await value().fill(secret);
  await capture('credentials-phone-dark-draft');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await value().getAttribute('type')).toBe('password');
  expect(
    await sheet().getByRole('tab', { name: '2. Sign-in', exact: true }).innerText(),
  ).not.toContain('Signed in');
  const bounds = await sheet()
    .locator('button:visible')
    .evaluateAll((buttons) =>
      buttons.map((button) => ({
        label: button.textContent,
        width: button.getBoundingClientRect().width,
        height: button.getBoundingClientRect().height,
      })),
    );
  expect(bounds.filter((button) => button.width < 43.5 || button.height < 43.5)).toEqual([]);
  await sheet().getByRole('button', { name: 'Discard changes', exact: true }).click();
  await sheet().getByRole('button', { name: 'Fixture terminal login', exact: true }).click();
  const terminal = sheet().getByRole('region', { name: 'Runtime sign-in terminal', exact: true });
  expect(
    await sheet()
      .locator('.runtime-terminal-keyboard-hint')
      .evaluate((element) => getComputedStyle(element).display),
  ).toBe('none');
  expect(await terminal.evaluate((element) => element.getBoundingClientRect().height)).toBe(180);
  await terminal.locator('.xterm-helper-textarea').focus();
  await page.keyboard.type('z');
  await expect
    .poll(() =>
      respond.mock.calls.some((call) => call[3].type === 'terminal' && call[3].data === 'z'),
    )
    .toBe(true);
  await capture('native-signin-terminal-phone-dark');
  expect(
    await sheet()
      .getByRole('link', { name: 'Open auth.openai.com sign-in', exact: true })
      .getAttribute('href'),
  ).toBe('https://auth.openai.com/activate?fixture=phone');
  expect(
    await sheet().getByRole('button', { name: 'Copy code FAKE-1234', exact: true }).isVisible(),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});
