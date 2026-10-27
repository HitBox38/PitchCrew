import { chromium, type Browser, type Page } from 'playwright';
import { defaultCapabilities, type Role, type BrowserInput } from '@pitchcrew/core';
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
    Object.assign(window, {
      nativeFixture: records,
      pitchcrewBrowser: {
        identify: async () => ownerId,
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
test('hides the guest for app menus and when the browser panel closes without releasing control', async () => {
  await page.getByRole('button', { name: 'Browser options', exact: true }).click();
  await vi.waitFor(async () => expect(await lastMount()).toBeNull());
  await page.keyboard.press('Escape');
  await vi.waitFor(async () => expect(await lastMount()).not.toBeNull());
  await page.locator('button[aria-controls="agent-browser-panel"]').click();
  await vi.waitFor(async () => expect(await lastMount()).toBeNull());
  expect(host.daemon.service.computer.browsers.list()[0].manual).toBe(true);
});
