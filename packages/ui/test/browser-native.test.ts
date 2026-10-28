import { chromium, type Browser, type Page } from 'playwright';
import {
  defaultCapabilities,
  type Role,
  type BrowserInput,
  type ComputerApproval,
} from '@pitchcrew/core';
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
  if (value.kind === 'navigate')
    state = {
      ...state,
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeTab ? { ...tab, url: value.url, title: 'Fixture page' } : tab,
      ),
    };
});
const setManual = vi.fn(async () => {});
const subscribeFrames = vi.fn(() => () => {});
let viewport = { width: 1280, height: 800 };
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
      getViewport: () => viewport,
      resize: async (size) => {
        viewport = size;
        return true;
      },
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
test('guides blank tabs without a guest overlay and keeps loading in the toolbar', async () => {
  state = {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === state.activeTab ? { ...tab, url: 'about:blank', title: '' } : tab,
    ),
  };
  await page.getByRole('heading', { name: 'No page open', exact: true }).waitFor();
  await vi.waitFor(async () => expect(await lastMount()).toBeNull());
  await page.getByRole('button', { name: 'Enter an address', exact: true }).click();
  expect(
    await page
      .getByRole('textbox', { name: 'Browser address' })
      .evaluate((element) => document.activeElement === element),
  ).toBe(true);
  const before = await page.getByLabel('Native browser page', { exact: true }).boundingBox();
  await page.screenshot({ path: '/tmp/pitchcrew-browser-empty.png' });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.screenshot({ path: '/tmp/pitchcrew-browser-empty-dark.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/pitchcrew-browser-empty-mobile.png' });
  expect(
    await page
      .locator('#agent-browser-panel')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  state = {
    ...state,
    tabs: state.tabs.map((tab) => ({ ...tab, loading: true })),
  };
  await page.getByLabel('Loading page', { exact: true }).waitFor();
  await vi.waitFor(async () => expect(await lastMount()).not.toBeNull());
  const during = await page.getByLabel('Native browser page', { exact: true }).boundingBox();
  expect(during?.y).toBe(before?.y);
  expect(during?.height).toBe(before?.height);
  expect(
    await page
      .locator('.browser-loading-progress > span[aria-hidden]')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  await page.screenshot({ path: '/tmp/pitchcrew-browser-loading.png' });
  state = {
    ...state,
    tabs: state.tabs.map((tab) => ({ ...tab, loading: false, url: 'https://example.com' })),
  };
  await page.getByLabel('Loading page', { exact: true }).waitFor({ state: 'hidden' });
});
test('keeps native approval evidence stable while requests appear, expand and resolve', async () => {
  const release = page.getByRole('button', { name: 'Return to agent', exact: true });
  if (await release.isVisible()) await release.click();
  const service = host.daemon.service;
  const scope = { runId: 'native-approval-layout', roleId: 'writer', cardId: null };
  service.computer.bindBrowser({ ...scope, threadId: 'writer' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const body = page.getByLabel('Native browser page', { exact: true });
  await body.waitFor();
  for (const size of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await vi.waitFor(
      async () => {
        const bounds = await body.boundingBox();
        expect(viewport.height).toBe(Math.round(bounds!.height - 2));
      },
      { timeout: 3000 },
    );
    const before = await body.boundingBox();
    for (let index = 0; index < 2; index++) {
      const approval = await service.computer.request(
        scope,
        { kind: 'navigate', url: 'https://example.com/apply' },
        'Inspect the fictional application form',
      );
      const review = page.getByRole('region', { name: 'Pending browser action', exact: true });
      await review.waitFor();
      expect((await body.boundingBox())?.height).toBe(before?.height);
      await review.getByRole('button', { name: 'Review exact action and page evidence' }).click();
      if (!index)
        await page.screenshot({ path: `/tmp/pitchcrew-browser-approval-${size.width}.png` });
      await expect.poll(async () => (await body.boundingBox())?.height).toBe(before?.height);
      expect(service.board.get<ComputerApproval>('computer_approval', approval.id).status).toBe(
        'pending',
      );
      expect((await service.snapshot({ workspace: true })).computerApprovals).toContainEqual(
        approval,
      );
      await review.getByRole('button', { name: 'Approve interaction', exact: true }).click();
      await review.waitFor({ state: 'hidden' });
      await service.computer.execute(
        scope.runId,
        approval.id,
        new AbortController().signal,
        () => {},
      );
      expect((await body.boundingBox())?.height).toBe(before?.height);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await service.computer.stop(scope.runId);
  await page.getByRole('button', { name: 'Take control', exact: true }).click();
}, 30000);
test('hides the guest for app menus and when the browser panel closes without releasing control', async () => {
  await page.getByRole('button', { name: 'Browser options', exact: true }).click();
  await vi.waitFor(async () => expect(await lastMount()).toBeNull());
  await page.keyboard.press('Escape');
  await vi.waitFor(async () => expect(await lastMount()).not.toBeNull());
  await page.locator('button[aria-controls="agent-browser-panel"]').click();
  await vi.waitFor(async () => expect(await lastMount()).toBeNull());
  expect(host.daemon.service.computer.browsers.list()[0].manual).toBe(true);
});
