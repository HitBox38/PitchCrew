import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { adapters } from '../../adapters/src/index.ts';
import {
  defaultRuntimeModelPreferences,
  type RuntimeInfo,
  type RuntimeModelPreferencesState,
} from '@pitchcrew/core';
import { RuntimeModelPreferencesStore } from '../../orchestrator/src/runtime-model-preferences/store.ts';
import { cleanup, setup } from './helpers/daemon.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
const errors: string[] = [];
const capture = async (name: string, target = page) => {
  const output = process.env.PITCHCREW_RUNTIME_SETUP_EVIDENCE;
  if (!output) return;
  await mkdir(resolve(output), { recursive: true });
  await target.evaluate(() => document.fonts.ready);
  const panel = target.locator('.runtime-setup-body');
  const bounds = await panel.evaluate((element) => ({
    height: element.clientHeight,
    total: element.scrollHeight,
  }));
  const count = Math.max(
    1,
    Math.ceil((bounds.total - bounds.height) / Math.max(200, bounds.height - 100)) + 1,
  );
  for (let part = 0; part < count; part++) {
    await panel.evaluate(
      (element, top) => element.scrollTo({ top, behavior: 'instant' }),
      Math.min(part * Math.max(200, bounds.height - 100), bounds.total - bounds.height),
    );
    await target.screenshot({
      path: resolve(output, `${name}${part ? `-part${part + 1}` : ''}.png`),
    });
  }
};
const models = [
  {
    value: 'fixture-alpha',
    label: 'Fixture Alpha',
    reasoning: { levels: ['low', 'high'] as const },
  },
  { value: 'fixture-beta', label: 'Fixture Beta' },
  { value: 'fixture-gamma', label: 'Fixture Gamma' },
];
const catalog = {
  models,
  modelSource: 'runtime' as const,
  modelDetail: 'Models reported by a fictional native catalog.',
};
const runtime: RuntimeInfo = {
  id: 'codex',
  available: true,
  customReasoning: true,
  version: '1.0.0',
  detail: 'Fixture installation',
  ...catalog,
};
const open = async (target = page) => {
  await target.goto(`${host.daemon.url}/settings?section=runtimes`);
  await target
    .getByRole('article', { name: 'Codex', exact: true })
    .getByRole('button', { name: 'Manage Codex', exact: true })
    .click();
  await target.getByRole('dialog', { name: 'Set up Codex', exact: true }).waitFor();
  await target.getByRole('tab', { name: '3. Models', exact: true }).click();
  await target
    .getByRole('region', { name: 'Codex models', exact: true })
    .getByRole('listitem', { name: 'Fixture Alpha model', exact: true })
    .waitFor();
};
beforeAll(async () => {
  host = await setup(false, { dev: false });
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  browser = await chromium.launch({ headless: true });
}, 60000);
beforeEach(async () => {
  const manager = host.daemon.service.runtimeMaintenance;
  manager.context().runtimes = [structuredClone(runtime)];
  manager.context().modelCatalogs.set('codex', {
    catalog: structuredClone(catalog),
    expiresAt: Date.now() + 300000,
  });
  manager.configure(false);
  vi.spyOn(adapters.codex, 'detect').mockResolvedValue(runtime);
  vi.spyOn(adapters.codex, 'listModels').mockResolvedValue(models);
  vi.spyOn(host.daemon.service, 'detect').mockImplementation(
    async () => manager.context().runtimes,
  );
  const store = new RuntimeModelPreferencesStore(host.directory);
  store.save('codex', defaultRuntimeModelPreferences(), store.current('codex').revision);
  errors.length = 0;
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(10000);
});
afterEach(async () => {
  await page?.close();
  vi.restoreAllMocks();
  expect(errors).toEqual([]);
});
afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('central model choices persist favorites, visibility and unverified custom reasoning without changing agents', async () => {
  const before = JSON.stringify(host.daemon.service.board.list('role'));
  await open();
  await page.getByRole('button', { name: 'Favorite Fixture Beta', exact: true }).click();
  await expect
    .poll(() =>
      page
        .getByRole('button', { name: 'Unfavorite Fixture Beta', exact: true })
        .getAttribute('aria-pressed'),
    )
    .toBe('true');
  await page
    .getByRole('switch', { name: 'Show Fixture Alpha in model pickers', exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .getByRole('switch', { name: 'Show Fixture Alpha in model pickers', exact: true })
        .isChecked(),
    )
    .toBe(false);
  await page.getByRole('button', { name: 'Add custom model', exact: true }).click();
  await page.getByRole('textbox', { name: 'Model selector', exact: true }).fill('fixture-custom');
  await page
    .getByRole('textbox', { name: 'Display name (optional)', exact: true })
    .fill('Fixture Custom');
  await page.getByRole('checkbox', { name: 'High', exact: true }).check();
  await capture('desktop-models-custom-editor');
  await page.getByRole('button', { name: 'Save model', exact: true }).click();
  const custom = page.getByRole('listitem', { name: 'Fixture Custom model', exact: true });
  await custom.getByText('Custom · unverified', { exact: true }).waitFor();
  await expect
    .poll(() =>
      page
        .getByRole('button', { name: 'Add custom model', exact: true })
        .evaluate((element) => document.activeElement === element),
    )
    .toBe(true);
  const result = (
    await host.request<RuntimeModelPreferencesState>('/runtimes/codex/model-preferences')
  ).result;
  expect(result.preferences).toMatchObject({
    favorite: ['fixture-beta'],
    hidden: ['fixture-alpha'],
    custom: [{ value: 'fixture-custom', label: 'Fixture Custom', reasoning: { levels: ['high'] } }],
  });
  expect(JSON.stringify(host.daemon.service.board.list('role'))).toBe(before);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await open();
  const names = await page
    .getByRole('list', { name: 'Model choices', exact: true })
    .getByRole('listitem')
    .evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')));
  expect(names[0]).toBe('Fixture Beta model');
  expect(
    await page
      .getByRole('switch', { name: 'Show Fixture Alpha in model pickers', exact: true })
      .isChecked(),
  ).toBe(false);
  await capture('desktop-models-configured');
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  phone.setDefaultTimeout(10000);
  phone.on('pageerror', (error) => errors.push(error.message));
  try {
    await open(phone);
    await capture('phone-dark-models-configured', phone);
    await phone.getByRole('button', { name: 'Edit Fixture Custom', exact: true }).click();
    await phone.getByRole('textbox', { name: 'Model selector', exact: true }).waitFor();
    await capture('phone-dark-models-custom-editor', phone);
  } finally {
    await phone.close();
  }
});

test('custom drafts survive tab changes and guarded dismissal, reject duplicates, and restore focus on discard', async () => {
  await open();
  await page.getByRole('button', { name: 'Add custom model', exact: true }).click();
  const selector = page.getByRole('textbox', { name: 'Model selector', exact: true });
  await selector.fill('fixture-alpha');
  await page.getByRole('button', { name: 'Save model', exact: true }).click();
  await page.getByText('That model selector is already listed.', { exact: true }).waitFor();
  await selector.fill('fixture-unsaved');
  await page.getByRole('tab', { name: '1. Installation', exact: true }).click();
  await page.getByRole('tab', { name: '3. Models', exact: true }).click();
  expect(await selector.inputValue()).toBe('fixture-unsaved');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect(await selector.inputValue()).toBe('fixture-unsaved');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Discard model changes?', exact: true })
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .getByRole('button', { name: 'Add custom model', exact: true })
        .evaluate((element) => document.activeElement === element),
    )
    .toBe(true);
  expect(
    (await host.request<RuntimeModelPreferencesState>('/runtimes/codex/model-preferences')).result
      .preferences.custom,
  ).toEqual([]);
});

test('a stale model editor reloads latest workspace choices and preserves its draft for an explicit retry', async () => {
  const other = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  other.setDefaultTimeout(10000);
  other.on('pageerror', (error) => errors.push(error.message));
  try {
    await open();
    await open(other);
    await page.getByRole('button', { name: 'Favorite Fixture Beta', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await host.request<RuntimeModelPreferencesState>('/runtimes/codex/model-preferences'))
            .result.preferences.favorite,
      )
      .toEqual(['fixture-beta']);
    await other.getByRole('button', { name: 'Add custom model', exact: true }).click();
    const selector = other.getByRole('textbox', { name: 'Model selector', exact: true });
    const label = other.getByRole('textbox', { name: 'Display name (optional)', exact: true });
    await selector.fill('fixture-conflict');
    await label.fill('Fixture Conflict');
    const [rejected] = await Promise.all([
      other.waitForResponse(
        (response) =>
          response.url().endsWith('/api/runtimes/codex/model-preferences') &&
          response.request().method() === 'PUT',
      ),
      other.getByRole('button', { name: 'Save model', exact: true }).click(),
    ]);
    expect(rejected.status()).toBe(409);
    await other
      .getByRole('alert')
      .filter({ hasText: /changed elsewhere|latest.*choices|review.*changes/i })
      .waitFor();
    expect(await selector.inputValue()).toBe('fixture-conflict');
    expect(await label.inputValue()).toBe('Fixture Conflict');
    await other.getByRole('button', { name: 'Unfavorite Fixture Beta', exact: true }).waitFor();
    await capture('desktop-models-conflict-draft', other);
    const [saved] = await Promise.all([
      other.waitForResponse(
        (response) =>
          response.url().endsWith('/api/runtimes/codex/model-preferences') &&
          response.request().method() === 'PUT',
      ),
      other.getByRole('button', { name: 'Save model', exact: true }).click(),
    ]);
    expect(saved.status()).toBe(200);
    await other.getByRole('listitem', { name: 'Fixture Conflict model', exact: true }).waitFor();
    const current = (
      await host.request<RuntimeModelPreferencesState>('/runtimes/codex/model-preferences')
    ).result.preferences;
    expect(current.favorite).toEqual(['fixture-beta']);
    expect(current.custom).toEqual([{ value: 'fixture-conflict', label: 'Fixture Conflict' }]);
  } finally {
    await other.close();
  }
});

test('editing a custom model restores its row action and announces persisted model choices', async () => {
  const store = new RuntimeModelPreferencesStore(host.directory);
  const state = store.current('codex');
  store.save(
    'codex',
    { ...state.preferences, custom: [{ value: 'fixture-edit', label: 'Fixture Edit' }] },
    state.revision,
  );
  await open();
  const edit = page.getByRole('button', { name: 'Edit Fixture Edit', exact: true });
  await edit.click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect
    .poll(() => edit.evaluate((element) => document.activeElement === element))
    .toBe(true);
  await edit.click();
  await page
    .getByRole('textbox', { name: 'Display name (optional)', exact: true })
    .fill('Fixture Renamed');
  await page.getByRole('button', { name: 'Save model', exact: true }).click();
  const renamed = page.getByRole('button', { name: 'Edit Fixture Renamed', exact: true });
  await expect
    .poll(() => renamed.evaluate((element) => document.activeElement === element))
    .toBe(true);
  await page.getByRole('status').filter({ hasText: /saved/i }).waitFor();
  expect(
    (await host.request<RuntimeModelPreferencesState>('/runtimes/codex/model-preferences')).result
      .preferences.custom,
  ).toEqual([{ value: 'fixture-edit', label: 'Fixture Renamed' }]);
  await capture('desktop-models-edit-saved');
});

test('large model catalogs page their rows while filtering searches the complete catalog', async () => {
  const many = [
    ...models,
    ...Array.from({ length: 67 }, (_, index) => ({
      value: `fixture-large-${index}`,
      label: `Fixture Large ${index}`,
    })),
  ];
  host.daemon.service.runtimeMaintenance.context().modelCatalogs.set('codex', {
    catalog: { ...catalog, models: many },
    expiresAt: Date.now() + 300000,
  });
  host.daemon.service.runtimeMaintenance.context().runtimes = [{ ...runtime, models: many }];
  await open();
  const list = page.getByRole('list', { name: 'Model choices', exact: true });
  expect(await list.getByRole('listitem').count()).toBe(50);
  await page.getByRole('button', { name: /^Show more models/ }).click();
  expect(await list.getByRole('listitem').count()).toBe(70);
  await page
    .getByRole('searchbox', { name: 'Filter Codex models', exact: true })
    .fill('Fixture Large 66');
  await list.getByRole('listitem', { name: 'Fixture Large 66 model', exact: true }).waitFor();
  expect(await list.getByRole('listitem').count()).toBe(1);
});

test('a delayed focus refresh cannot replace a newer successful model preference save', async () => {
  await open();
  let release: (() => void) | undefined;
  let captured: (() => void) | undefined;
  const reading = new Promise<void>((resolve) => {
    captured = resolve;
  });
  let hold = true;
  await page.route('**/api/runtimes/codex/model-preferences', async (route) => {
    if (route.request().method() !== 'GET' || !hold) return route.continue();
    hold = false;
    const response = await route.fetch();
    const source = await response.json();
    await new Promise<void>((resolve) => {
      release = resolve;
      captured?.();
    });
    await route.fulfill({ response, json: source });
  });
  try {
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await reading;
    await page.getByRole('button', { name: 'Favorite Fixture Alpha', exact: true }).click();
    await page.getByRole('button', { name: 'Unfavorite Fixture Alpha', exact: true }).waitFor();
    const arriving = page.waitForResponse(
      (response) =>
        response.url().endsWith('/runtimes/codex/model-preferences') &&
        response.request().method() === 'GET',
    );
    release?.();
    await arriving;
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    expect(
      await page.getByRole('button', { name: 'Unfavorite Fixture Alpha', exact: true }).isVisible(),
    ).toBe(true);
    expect(
      new RuntimeModelPreferencesStore(host.directory).current('codex').preferences.favorite,
    ).toEqual(['fixture-alpha']);
  } finally {
    release?.();
  }
});

test.each(['event', 'refresh'] as const)(
  'a delayed model-picker focus refresh cannot override newer choices from %s',
  async (source) => {
    const role = host.daemon.service.board.get<import('@pitchcrew/core').Role>('role', 'scout');
    await host.daemon.service.configureRole('scout', {
      ...role,
      runtime: 'codex',
      model: 'fixture-alpha',
      reasoning: 'low',
    });
    await open();
    await page.getByRole('button', { name: 'Configure Scout', exact: true }).click();
    const field = page.locator('#scout-model');
    await field.waitFor();
    await page.getByRole('button', { name: 'Refresh models', exact: true }).waitFor();
    // Ensure the initial model/catalog request has settled before delaying a focus refresh.
    await expect
      .poll(() => page.getByRole('button', { name: 'Refresh models', exact: true }).isEnabled())
      .toBe(true);
    let release: (() => void) | undefined;
    let captured: (() => void) | undefined;
    const reading = new Promise<void>((resolve) => {
      captured = resolve;
    });
    let hold = true;
    await page.route('**/api/runtimes/codex/model-preferences', async (route) => {
      if (route.request().method() !== 'GET' || !hold) return route.continue();
      hold = false;
      const response = await route.fetch();
      const source = await response.json();
      await new Promise<void>((resolve) => {
        release = resolve;
        captured?.();
      });
      await route.fulfill({ response, json: source });
    });
    try {
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await reading;
      const store = new RuntimeModelPreferencesStore(host.directory);
      const current = store.current('codex');
      const preferences = { ...current.preferences, hidden: ['fixture-beta'] };
      store.save('codex', preferences, current.revision);
      if (source === 'event') {
        await page.evaluate(
          (preferences) =>
            window.dispatchEvent(
              new CustomEvent('pitchcrew-model-preferences-changed', {
                detail: { runtime: 'codex', preferences },
              }),
            ),
          preferences,
        );
      } else {
        await page.getByRole('button', { name: 'Refresh models', exact: true }).click();
        await expect
          .poll(() => page.getByRole('button', { name: 'Refresh models', exact: true }).isEnabled())
          .toBe(true);
      }
      const arriving = page.waitForResponse(
        (response) =>
          response.url().endsWith('/runtimes/codex/model-preferences') &&
          response.request().method() === 'GET',
      );
      release?.();
      await arriving;
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      await field.fill('Fixture');
      await page.getByRole('option', { name: 'Fixture Gamma', exact: true }).waitFor();
      expect(await page.getByRole('option', { name: 'Fixture Beta', exact: true }).count()).toBe(0);
      expect(
        host.daemon.service.board.get<import('@pitchcrew/core').Role>('role', 'scout').model,
      ).toBe('fixture-alpha');
    } finally {
      release?.();
    }
  },
);

test('a successful model focus reload clears an earlier connection failure', async () => {
  await open();
  let fail = true;
  await page.route('**/api/runtimes/codex/model-preferences', async (route) => {
    if (route.request().method() !== 'GET' || !fail) return route.continue();
    return route.fulfill({ status: 503, json: { error: 'Fixture model connection unavailable.' } });
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page
    .getByRole('alert')
    .filter({ hasText: 'Fixture model connection unavailable.' })
    .waitFor();
  fail = false;
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/runtimes/codex/model-preferences') &&
      response.request().method() === 'GET',
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await refreshed;
  await expect
    .poll(() =>
      page.getByRole('alert').filter({ hasText: 'Fixture model connection unavailable.' }).count(),
    )
    .toBe(0);
  expect(
    await page.getByRole('button', { name: 'Favorite Fixture Alpha', exact: true }).isVisible(),
  ).toBe(true);
});

test('focus and visibility refreshes read saved choices without starting native discovery after its cache expires', async () => {
  await open();
  const context = host.daemon.service.runtimeMaintenance.context();
  const cached = context.modelCatalogs.get('codex')!;
  context.modelCatalogs.set('codex', { ...cached, expiresAt: Date.now() - 1 });
  const discovery = vi.spyOn(adapters.codex, 'listModels');
  discovery.mockClear();
  for (const event of ['focus', 'visibilitychange']) {
    const read = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/runtimes/codex/model-preferences') &&
        response.request().method() === 'GET',
    );
    await page.evaluate((event) => {
      (event === 'focus' ? window : document).dispatchEvent(new Event(event));
    }, event);
    expect((await read).status()).toBe(200);
  }
  const choices = await host.request<RuntimeModelPreferencesState>(
    '/runtimes/codex/model-preferences',
  );
  expect(choices.response.status).toBe(200);
  expect(choices.result.catalog.models).toEqual(models);
  expect(discovery).not.toHaveBeenCalled();
  discovery.mockResolvedValue([
    ...models,
    { value: 'fixture-refreshed', label: 'Fixture Refreshed' },
  ]);
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/runtimes/codex/models') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Refresh models', exact: true }).click();
  expect((await refreshed).status()).toBe(200);
  await expect
    .poll(() => page.getByRole('button', { name: 'Refresh models', exact: true }).isEnabled())
    .toBe(true);
  expect(discovery).toHaveBeenCalledTimes(1);
  await page.getByRole('listitem', { name: 'Fixture Refreshed model', exact: true }).waitFor();
  await expect
    .poll(() => page.getByRole('tab', { name: '3. Models', exact: true }).innerText())
    .toContain('4 native');
});

test('unreadable model choices retain fresh native discovery in agent settings without inventing missing custom reasoning', async () => {
  const store = new RuntimeModelPreferencesStore(host.directory);
  const current = store.current('codex');
  store.save(
    'codex',
    {
      ...current.preferences,
      custom: [
        {
          value: 'fixture-lost-custom',
          label: 'Fixture Lost Custom',
          reasoning: { levels: ['high'] },
        },
      ],
    },
    current.revision,
  );
  const role = host.daemon.service.board.get<import('@pitchcrew/core').Role>('role', 'scout');
  await host.daemon.service.configureRole('scout', {
    ...role,
    runtime: 'codex',
    model: 'fixture-lost-custom',
    reasoning: 'high',
  });
  const healthy = await readFile(store.path, 'utf8');
  const damaged = healthy + '\nfictional unreadable choices';
  await writeFile(store.path, damaged, { mode: 0o600 });
  const fresh = [...models, { value: 'fixture-fresh-native', label: 'Fixture Fresh Native' }];
  vi.spyOn(adapters.codex, 'listModels').mockResolvedValue(fresh);
  try {
    const discovered = await host.request<import('@pitchcrew/core').RuntimeModelCatalog>(
      '/runtimes/codex/models',
      'POST',
      { refresh: true },
    );
    expect(discovered.response.status).toBe(200);
    expect(discovered.result.models).toEqual(fresh);
    expect(discovered.result.modelSource).toBe('runtime');
    const choices = await host.request<RuntimeModelPreferencesState>(
      '/runtimes/codex/model-preferences',
    );
    expect(choices.response.status).toBe(200);
    expect(choices.result.readError).toMatchObject({
      code: 'unreadable',
      message: expect.any(String),
    });
    expect(choices.result.catalog.models).toEqual(fresh);
    expect(choices.result.preferences).toEqual(defaultRuntimeModelPreferences());
    expect(choices.result.revision).toBe('');
    await open();
    await page.getByRole('button', { name: 'Configure Scout', exact: true }).click();
    const field = page.locator('#scout-model');
    await field.waitFor();
    await page
      .getByRole('status')
      .filter({ hasText: 'Saved model choices cannot be read.' })
      .waitFor();
    await expect
      .poll(() => page.getByRole('button', { name: 'Refresh models', exact: true }).isEnabled())
      .toBe(true);
    expect(await field.inputValue()).toBe('fixture-lost-custom');
    expect(await page.locator('#scout-model-reasoning').count()).toBe(0);
    const output = process.env.PITCHCREW_RUNTIME_SETUP_EVIDENCE;
    if (output) {
      await mkdir(resolve(output), { recursive: true });
      await field.scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(output, 'v5-agent-lost-custom-before-selection.png') });
    }
    await field.fill('Fixture Fresh Native');
    await page.getByRole('option', { name: 'Fixture Fresh Native', exact: true }).waitFor();
    await field.fill('Fixture Alpha');
    await page.getByRole('option', { name: 'Fixture Alpha', exact: true }).click();
    await page.locator('#scout-model-reasoning').waitFor();
    expect(await page.locator('#scout-model-reasoning').isEnabled()).toBe(true);
    const saved = host.daemon.service.board.get<import('@pitchcrew/core').Role>('role', 'scout');
    expect({ model: saved.model, reasoning: saved.reasoning }).toEqual({
      model: 'fixture-lost-custom',
      reasoning: 'high',
    });
    expect(await readFile(store.path, 'utf8')).toBe(damaged);
    if (output) {
      await mkdir(resolve(output), { recursive: true });
      await page.screenshot({
        path: resolve(output, 'v4-agent-native-models-unreadable-choices.png'),
      });
    }
  } finally {
    await writeFile(store.path, healthy, { mode: 0o600 });
  }
});

test('recovering unreadable model choices requires confirmation, keeps a byte-exact backup and leaves agents and chats unchanged', async () => {
  const store = new RuntimeModelPreferencesStore(host.directory);
  const otherRuntime = store.current('claude-code');
  store.save(
    'claude-code',
    {
      ...otherRuntime.preferences,
      favorite: ['fixture-other'],
      custom: [{ value: 'fixture-other', label: 'Fixture Other' }],
    },
    otherRuntime.revision,
  );
  const before = {
    roles: JSON.stringify(host.daemon.service.board.list('role')),
    messages: JSON.stringify(host.daemon.service.board.list('message')),
    conversations: JSON.stringify(host.daemon.service.board.list('conversation')),
    events: host.daemon.service.board.db.prepare('SELECT count(*) AS count FROM events').get(),
  };
  const healthy = await host.request('/runtimes/codex/model-preferences/reset', 'POST', {
    confirmed: true,
  });
  expect(healthy.response.ok).toBe(false);
  const damaged = (await readFile(store.path, 'utf8')) + '\nfictional damaged suffix';
  await writeFile(store.path, damaged, { mode: 0o600 });
  const unconfirmed = await host.request('/runtimes/codex/model-preferences/reset', 'POST', {});
  expect(unconfirmed.response.ok).toBe(false);
  expect(await readFile(store.path, 'utf8')).toBe(damaged);
  const unreadable = await host.request<RuntimeModelPreferencesState>(
    '/runtimes/codex/model-preferences',
  );
  expect(unreadable.response.status).toBe(200);
  expect(unreadable.result.readError).toMatchObject({
    code: 'unreadable',
    message: expect.any(String),
  });
  expect(unreadable.result.revision).toBe('');
  expect(unreadable.result.catalog.models).toEqual(models);
  expect(unreadable.result.preferences).toEqual(defaultRuntimeModelPreferences());
  await page.goto(`${host.daemon.url}/settings?section=runtimes`);
  await page
    .getByRole('article', { name: 'Codex', exact: true })
    .getByRole('button', { name: 'Manage Codex', exact: true })
    .click();
  await page.getByRole('dialog', { name: 'Set up Codex', exact: true }).waitFor();
  await page.getByRole('tab', { name: '3. Models', exact: true }).click();
  await page.getByRole('button', { name: 'Recover model choices', exact: true }).waitFor();
  const native = page.getByRole('region', { name: 'Codex models', exact: true });
  expect(await native.getByRole('listitem').count()).toBe(3);
  expect(
    await native.getByRole('button', { name: 'Favorite Fixture Alpha', exact: true }).isDisabled(),
  ).toBe(true);
  expect(
    await native
      .getByRole('switch', { name: 'Show Fixture Alpha in model pickers', exact: true })
      .isDisabled(),
  ).toBe(true);
  expect(
    await native.getByRole('button', { name: 'Add custom model', exact: true }).isDisabled(),
  ).toBe(true);
  expect(await native.getByText('Use Refresh models to try again.', { exact: true }).count()).toBe(
    0,
  );
  expect(await readFile(store.path, 'utf8')).toBe(damaged);
  await capture('desktop-models-unreadable');
  await page.getByRole('button', { name: 'Recover model choices', exact: true }).click();
  const confirmation = page.getByRole('dialog', {
    name: 'Reset saved model choices?',
    exact: true,
  });
  await confirmation.getByText(/all runtimes/i).waitFor();
  expect(await confirmation.innerText()).toMatch(/custom.*definition/i);
  expect(await confirmation.innerText()).toMatch(/backup/i);
  const [response] = await Promise.all([
    page.waitForResponse(
      (result) =>
        result.url().endsWith('/api/runtimes/codex/model-preferences/reset') &&
        result.request().method() === 'POST',
    ),
    confirmation.getByRole('button', { name: 'Reset model choices', exact: true }).click(),
  ]);
  expect(response.status()).toBe(200);
  const result = (await response.json()) as { ok: boolean; backup: string };
  expect(result.ok).toBe(true);
  expect(result.backup).toMatch(/^runtime-model-preferences\.invalid-[a-f0-9-]{36}\.json$/);
  const backup = resolve(host.directory, result.backup);
  expect(dirname(backup)).toBe(resolve(host.directory));
  expect(await readFile(backup, 'utf8')).toBe(damaged);
  await page
    .getByRole('region', { name: 'Codex models', exact: true })
    .getByRole('listitem', { name: 'Fixture Alpha model', exact: true })
    .waitFor();
  expect(store.current('codex').preferences).toEqual(defaultRuntimeModelPreferences());
  expect(store.current('claude-code').preferences).toEqual(defaultRuntimeModelPreferences());
  expect(JSON.stringify(host.daemon.service.board.list('role'))).toBe(before.roles);
  expect(JSON.stringify(host.daemon.service.board.list('message'))).toBe(before.messages);
  expect(JSON.stringify(host.daemon.service.board.list('conversation'))).toBe(before.conversations);
  expect(
    host.daemon.service.board.db.prepare('SELECT count(*) AS count FROM events').get(),
  ).toEqual(before.events);
  await capture('desktop-models-recovered');
});
