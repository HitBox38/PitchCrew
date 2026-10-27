import { chromium, type Browser, type Page } from 'playwright';
import { defaultCapabilities, type Role, type BrowserInput } from '@pitchcrew/core';
import type {
  BrowserProfilesState,
  BrowserProfilesCommand,
} from '../../core/src/browser-profiles.ts';
import type { NativeBrowserState } from '../../core/src/native-browser.ts';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { setup, cleanup } from './helpers/daemon.ts';

const native = {
  id: '8533d8c4-4846-4fe3-a1dd-3685cbd2f6f5',
  ownerId: '8f676ac0-43e0-42d8-b28c-144a059134de',
};
let state: NativeBrowserState = {
  ...native,
  activeTab: 'one',
  tabs: [
    {
      id: 'one',
      title: 'Fictional application',
      url: 'https://example.com/apply',
      loading: false,
      canGoBack: true,
      canGoForward: false,
    },
  ],
};
let browser: Browser;
let page: Page;
let host: Awaited<ReturnType<typeof setup>>;
const input = vi.fn(async (value: BrowserInput) => {
  if (value.kind === 'dialog') state = { ...state, dialog: undefined };
});
const setManual = vi.fn(async () => {});
const subscribeFrames = vi.fn(() => () => {});
const nativeCommand = vi.fn(async (command: { kind: string }) => {
  if (command.kind === 'new-tab')
    state = {
      ...state,
      activeTab: 'two',
      tabs: [
        ...state.tabs,
        {
          id: 'two',
          title: '',
          url: 'about:blank',
          loading: false,
          canGoBack: false,
          canGoForward: false,
        },
      ],
    };
  return state;
});
beforeAll(async () => {
  host = await setup(23950, false, {
    browserLaunch: async () => ({
      native,
      nativeState: async () => state,
      nativeCommand,
      setManual,
      subscribeFrames,
      input,
      resize: async () => true,
      snapshot: async () => ({
        url: state.tabs[0].url,
        title: 'Fixture',
        text: 'Fixture',
        screenshot: '',
        digest: 'fixture',
      }),
      perform: async () => {},
      close: async () => {},
    }),
  });
  const service = host.daemon.service;
  const role = service.board.get<Role>('role', 'writer');
  service.board.record(
    'role',
    { ...role, capabilities: { ...defaultCapabilities, ...role.capabilities, computerUse: true } },
    'user',
    'Native UI fixture',
  );
  await service.computer.openBrowser('writer', 'writer', null);
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(({ ownerId }) => {
    const records = { mounts: [] as unknown[], finds: [] as unknown[] };
    let profiles: BrowserProfilesState = {
      profiles: [{ id: 'default', name: 'Default' }],
      selectedId: 'default',
      currentId: 'default',
    };
    Object.assign(window, {
      nativeFixture: records,
      pitchcrewBrowser: {
        identify: async () => ownerId,
        profiles: async (_id: string, command: BrowserProfilesCommand) => {
          if (command.kind === 'create')
            profiles.profiles.push({
              id: '8533d8c4-4846-4fe3-a1dd-3685cbd2f6f5',
              name: command.name,
            });
          if (command.kind === 'select') profiles.selectedId = command.id;
          if (command.kind === 'begin-import')
            profiles.preview = {
              token: '8f676ac0-43e0-42d8-b28c-144a059134de',
              profileName: profiles.profiles.find((item) => item.id === command.id)!.name,
              count: 2,
              skipped: 1,
              domains: ['example.com'],
            };
          if (command.kind === 'confirm-import') {
            profiles = { ...profiles, preview: undefined, imported: 2 };
          }
          if (command.kind === 'cancel-import') profiles = { ...profiles, preview: undefined };
          return structuredClone(profiles);
        },
        focusPage: async () => {},
        focusControls: async () => {},
        mount: async (id: string, bounds: unknown) => {
          records.mounts.push({ id, bounds });
        },
        find: async (...args: unknown[]) => {
          records.finds.push(args);
        },
        subscribeShortcuts: () => () => {},
      },
    });
  }, native);
  await page.goto(`${host.daemon.url}/chat/writer`, { waitUntil: 'domcontentloaded' });
  await page.locator('button[aria-controls="agent-browser-panel"]').waitFor({ timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
  await page.locator('button[aria-controls="agent-browser-panel"]').click();
  await page.getByLabel('Native browser page', { exact: true }).waitFor();
}, 60000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
});
const lastMount = () =>
  page.evaluate(
    () =>
      (
        window as unknown as { nativeFixture: { mounts: { bounds: unknown }[] } }
      ).nativeFixture.mounts.at(-1)?.bounds,
  );

test('uses the native surface and browser controls without screenshot or private-text proxies', async () => {
  await vi.waitFor(async () =>
    expect(await lastMount()).toMatchObject({
      width: expect.any(Number),
      height: expect.any(Number),
    }),
  );
  expect(await page.locator('.browser-screen').count()).toBe(0);
  expect(subscribeFrames).not.toHaveBeenCalled();
  await page.getByRole('button', { name: 'Take control', exact: true }).click();
  await page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
  expect(setManual).toHaveBeenCalledWith(true);
  await page.getByRole('button', { name: 'New browser tab', exact: true }).click();
  await vi.waitFor(() => expect(nativeCommand).toHaveBeenCalledWith({ kind: 'new-tab' }));
  await page.getByRole('textbox', { name: 'Browser address' }).fill('example.com');
  await page.getByRole('button', { name: 'Go to address', exact: true }).click();
  await vi.waitFor(() =>
    expect(input).toHaveBeenCalledWith({ kind: 'navigate', url: 'https://example.com' }),
  );
  await page.getByRole('textbox', { name: 'Browser address' }).focus();
  await page.keyboard.press('Control+l');
  expect(
    await page
      .getByRole('textbox', { name: 'Browser address' })
      .evaluate((element) => (element as HTMLInputElement).selectionStart),
  ).toBe(0);
  await page.keyboard.press('Control+r');
  await vi.waitFor(() => expect(nativeCommand).toHaveBeenCalledWith({ kind: 'reload' }));
  await page.keyboard.press('Control+f');
  await page.getByRole('textbox', { name: 'Find on page' }).fill('Engineer');
  await vi.waitFor(async () =>
    expect(
      await page.evaluate(() =>
        (window as unknown as { nativeFixture: { finds: unknown[][] } }).nativeFixture.finds.some(
          (args) => args[1] === 'Engineer',
        ),
      ),
    ).toBe(true),
  );
  await page.getByRole('button', { name: 'Close page search' }).click();
});
test('shows website dialogs in native mode and sends the manual decision', async () => {
  state = { ...state, dialog: { type: 'confirm', message: 'Continue fictional application?' } };
  await page.getByRole('region', { name: 'Website dialog' }).waitFor();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await vi.waitFor(() =>
    expect(input).toHaveBeenCalledWith({ kind: 'dialog', decision: 'accept', text: '' }),
  );
  await page.getByRole('region', { name: 'Website dialog' }).waitFor({ state: 'hidden' });
});
test('provides native zoom, cache, loading and failure recovery controls', async () => {
  await page.getByRole('button', { name: 'Browser page settings' }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await vi.waitFor(() =>
    expect(nativeCommand).toHaveBeenCalledWith({ kind: 'zoom', factor: 1.25 }),
  );
  await page.getByRole('button', { name: 'Hard reload', exact: true }).click();
  await vi.waitFor(() => expect(nativeCommand).toHaveBeenCalledWith({ kind: 'hard-reload' }));
  await page.getByRole('button', { name: 'Clear cached website files', exact: true }).click();
  await vi.waitFor(() => expect(nativeCommand).toHaveBeenCalledWith({ kind: 'clear-cache' }));
  await page.keyboard.press('Escape');
  state = { ...state, tabs: state.tabs.map((tab) => ({ ...tab, loading: true })) };
  await page.getByRole('button', { name: 'Stop loading', exact: true }).click();
  await vi.waitFor(() => expect(nativeCommand).toHaveBeenCalledWith({ kind: 'stop' }));
  state = {
    ...state,
    tabs: state.tabs.map((tab) => ({
      ...tab,
      loading: false,
      error: 'Fictional page failed to load.',
    })),
  };
  await page.getByRole('button', { name: 'Retry page', exact: true }).click();
  state = { ...state, tabs: state.tabs.map((tab) => ({ ...tab, error: undefined })) };
});
test('manages named profiles and reviews a session import before confirmation', async () => {
  await page.getByRole('button', { name: 'Browser page settings' }).click();
  await page.getByRole('button', { name: 'Manage browser profiles' }).click();
  await page.getByRole('textbox', { name: 'New browser profile name' }).fill('Work');
  await page.getByRole('button', { name: 'Create profile', exact: true }).click();
  const work = page.getByRole('region', { name: 'Browser profile Work' });
  await work.getByRole('button', { name: 'Use for new sessions' }).click();
  await work.getByText('Default for new browser sessions.', { exact: true }).waitFor();
  await work.getByRole('button', { name: 'Import sessions', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Import reviewed sessions' });
  expect(await confirm.isDisabled()).toBe(true);
  await page.getByRole('checkbox').check();
  await confirm.click();
  await page.getByRole('status').filter({ hasText: 'Imported 2 website cookies.' }).waitFor();
  await page.getByRole('button', { name: 'Close profiles' }).click();
  await page.keyboard.press('Escape');
});
test('hides the guest for app menus and when the browser panel closes without releasing control', async () => {
  await page.getByRole('button', { name: 'Browser options', exact: true }).click();
  await vi.waitFor(async () => expect(await lastMount()).toBeNull());
  await page.keyboard.press('Escape');
  await vi.waitFor(async () => expect(await lastMount()).not.toBeNull());
  await page.locator('button[aria-controls="agent-browser-panel"]').click();
  await vi.waitFor(async () => expect(await lastMount()).toBeNull());
  expect(host.daemon.service.computer.browsers.list()[0].manual).toBe(true);
});
