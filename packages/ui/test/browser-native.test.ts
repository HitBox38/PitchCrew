import { chromium, type Browser, type Page, type Request } from 'playwright';
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
import type {
  DesktopBrowserView,
  NativeBrowserCommand,
  NativeBrowserState,
} from '../../core/src/native-browser.ts';
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
let modifier: 'Meta' | 'Control';
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
let tabSerial = 1;
const nativeCommand = vi.fn(async (command: NativeBrowserCommand) => {
  if (command.kind === 'new-tab') {
    const id = ++tabSerial === 2 ? 'two' : `fixture-tab-${tabSerial}`;
    state = {
      ...state,
      activeTab: id,
      tabs: [
        ...state.tabs,
        {
          id,
          title: '',
          url: 'about:blank',
          loading: false,
          canGoBack: false,
          canGoForward: false,
        },
      ],
    };
  }
  if (command.kind === 'select-tab') state = { ...state, activeTab: command.tabId };
  if (command.kind === 'close-tab') {
    const tabs = state.tabs.filter((tab) => tab.id !== command.tabId);
    state = {
      ...state,
      tabs,
      activeTab: tabs.some((tab) => tab.id === state.activeTab)
        ? state.activeTab
        : (tabs.at(-1)?.id ?? ''),
    };
  }
  if (command.kind === 'mute')
    state = {
      ...state,
      tabs: state.tabs.map((tab) =>
        tab.id === (command.tabId ?? state.activeTab) ? { ...tab, muted: command.muted } : tab,
      ),
    };
  if (command.kind === 'appearance')
    state = {
      ...state,
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeTab ? { ...tab, colorScheme: command.colorScheme } : tab,
      ),
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
    const records = {
      mounts: [] as unknown[],
      finds: [] as unknown[],
      captures: 0,
      artifacts: [] as { kind: 'png' | 'webm'; data: string }[],
      copied: [] as string[],
      revealed: [] as string[],
      floating: [] as { id: string; open: boolean }[],
      guestClicks: 0,
      guardedClicks: 0,
    };
    const stateListeners = new Set<(next: NativeBrowserState) => void>();
    const viewListeners = new Set<(next: DesktopBrowserView[]) => void>();
    document.addEventListener(
      'click',
      (event) => {
        if (!(event.target instanceof Element)) return;
        if (event.target.closest('webview')) records.guestClicks++;
        if (event.target.closest('[data-browser-input-guard]')) records.guardedClicks++;
      },
      true,
    );
    let profiles: BrowserProfilesState = {
      profiles: [{ id: 'default', name: 'Default' }],
      selectedId: 'default',
      currentId: 'default',
    };
    Object.assign(window, {
      nativeFixture: records,
      publishBrowserState: (next: NativeBrowserState) => {
        for (const receive of stateListeners) receive(next);
      },
      publishBrowserViews: (next: DesktopBrowserView[]) => {
        for (const receive of viewListeners) receive(next);
      },
      pitchcrewBrowser: {
        capture: async () => {
          records.captures++;
          const canvas = document.createElement('canvas');
          canvas.width = 700;
          canvas.height = 400;
          const context = canvas.getContext('2d')!;
          context.fillStyle = records.captures % 2 ? '#2e9b80' : '#387cc5';
          context.fillRect(0, 0, canvas.width, canvas.height);
          return {
            data: canvas.toDataURL('image/png').split(',')[1],
            width: canvas.width,
            height: canvas.height,
            url: 'https://example.com/apply',
            title: 'Fictional application',
          };
        },
        saveArtifact: async (kind: 'png' | 'webm', data: string) => {
          records.artifacts.push({ kind, data });
          return `/tmp/fictional-browser-artifact.${kind}`;
        },
        copyCapture: async (data: string) => {
          records.copied.push(data);
        },
        revealArtifact: async (path: string) => {
          records.revealed.push(path);
        },
        floating: async (id: string, open: boolean) => {
          records.floating.push({ id, open });
        },
        identify: async () => ownerId,
        views: async () => [
          {
            token: 'fixture-guest',
            partition: 'persist:fixture',
            contentsId: 99,
            bounds: null,
            painting: false,
            manual: false,
          },
        ],
        registerView: async () => {},
        subscribeViews: (receive: (next: DesktopBrowserView[]) => void) => {
          viewListeners.add(receive);
          return () => viewListeners.delete(receive);
        },
        subscribeState: (receive: (next: NativeBrowserState) => void) => {
          stateListeners.add(receive);
          return () => stateListeners.delete(receive);
        },
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
  modifier = await page.evaluate(() =>
    /Mac|iPhone|iPad/.test(navigator.platform) ? 'Meta' : 'Control',
  );
  await page.locator('button[aria-controls="agent-browser-panel"]').waitFor({ timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
  await page.locator('button[aria-controls="agent-browser-panel"]').click();
  await page.getByLabel('Native browser page', { exact: true }).waitFor();
  page.setDefaultTimeout(5000);
}, 60000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
}, 30000);
const lastPresentation = () =>
  page.evaluate(() =>
    (
      window as unknown as {
        nativeFixture: { mounts: { bounds: unknown }[] };
      }
    ).nativeFixture.mounts.at(-1),
  );
const lastMount = async () => {
  const presentation = await lastPresentation();
  return presentation?.bounds;
};

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
  await page.keyboard.press(`${modifier}+l`);
  expect(
    await page
      .getByRole('textbox', { name: 'Browser address' })
      .evaluate((element) => (element as HTMLInputElement).selectionStart),
  ).toBe(0);
  await page.keyboard.press(`${modifier}+r`);
  await vi.waitFor(() => expect(nativeCommand).toHaveBeenCalledWith({ kind: 'reload' }));
  await page.keyboard.press(`${modifier}+f`);
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
test('restores address drafts, searches on Enter and switches the focused address to its selected tab', async () => {
  const address = page.getByRole('textbox', { name: 'Browser address' });
  await address.focus();
  const selected = await address.evaluate((element) => {
    const input = element as HTMLInputElement;
    return { start: input.selectionStart, end: input.selectionEnd, value: input.value };
  });
  expect(selected.start).toBe(0);
  expect(selected.end).toBe(selected.value.length);
  const calls = input.mock.calls.length;
  await address.fill('unfinished search');
  await address.press('Escape');
  expect(await address.inputValue()).toBe('https://example.com');
  expect(input.mock.calls.length).toBe(calls);
  await address.fill('fictional hiring team');
  await address.press('Enter');
  await vi.waitFor(() =>
    expect(input).toHaveBeenCalledWith({
      kind: 'navigate',
      url: 'https://www.google.com/search?q=fictional%20hiring%20team',
    }),
  );
  await address.focus();
  await address.fill('do not carry between tabs');
  state = { ...state, activeTab: 'one' };
  await vi.waitFor(async () =>
    expect(await address.inputValue()).toBe('https://example.com/apply'),
  );
  await address.press('Escape');
});
test('receives native navigation events without waiting for polling and rejects another session update', async () => {
  const stale = { ...structuredClone(state), warning: 'Fictional delayed backend status.' };
  let held = false;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/browser/writer/native?*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    if (held) return route.abort();
    held = true;
    await gate;
    await route.fulfill({ json: stale });
  });
  await vi.waitFor(() => expect(held).toBe(true));
  state = {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.id === state.activeTab
        ? { ...tab, title: 'Live event page', url: 'https://example.com/live-events' }
        : tab,
    ),
  };
  await page.evaluate((next) => {
    (
      window as unknown as { publishBrowserState: (next: NativeBrowserState) => void }
    ).publishBrowserState(next);
  }, state);
  await vi.waitFor(async () =>
    expect(await page.getByRole('textbox', { name: 'Browser address' }).inputValue()).toBe(
      'https://example.com/live-events',
    ),
  );
  release();
  await page.getByText(stale.warning, { exact: true }).waitFor();
  expect(await page.getByRole('textbox', { name: 'Browser address' }).inputValue()).toBe(
    'https://example.com/live-events',
  );
  await page.evaluate((next) => {
    (
      window as unknown as { publishBrowserState: (next: NativeBrowserState) => void }
    ).publishBrowserState({ ...next, id: 'another-session', activeTab: 'foreign', tabs: [] });
  }, state);
  expect(await page.getByRole('textbox', { name: 'Browser address' }).inputValue()).toBe(
    'https://example.com/live-events',
  );
  await page.unroute('**/api/browser/writer/native?*');
  await page.getByText(stale.warning, { exact: true }).waitFor({ state: 'hidden' });
});
test('reopens visited and closed pages through the same leased native browser', async () => {
  await page.getByRole('button', { name: 'Browser history', exact: true }).click();
  const history = page.getByRole('region', { name: 'Recently visited in this profile' });
  await history.getByRole('button').filter({ hasText: 'Live event page' }).click();
  await vi.waitFor(() =>
    expect(input).toHaveBeenCalledWith({
      kind: 'navigate',
      url: 'https://example.com/live-events',
    }),
  );
  await vi.waitFor(async () =>
    expect(
      await page.getByRole('button', { name: 'Return to agent', exact: true }).isEnabled(),
    ).toBe(true),
  );
  await page.locator('.browser-tab[data-active="true"] .browser-tab-close').click();
  await page.getByRole('button', { name: 'Browser history', exact: true }).click();
  await page
    .getByRole('region', { name: 'Recently closed in this conversation' })
    .getByRole('button')
    .filter({ hasText: 'https://example.com/live-events' })
    .click();
  await vi.waitFor(() => expect(nativeCommand).toHaveBeenLastCalledWith({ kind: 'new-tab' }));
  await vi.waitFor(() =>
    expect(state.tabs.find((tab) => tab.id === state.activeTab)?.url).toBe(
      'https://example.com/live-events',
    ),
  );
  await page.getByRole('button', { name: 'Browser history', exact: true }).click();
  expect(
    await page
      .getByRole('region', { name: 'Recently closed in this conversation' })
      .getByRole('button')
      .count(),
  ).toBe(0);
  await page.getByRole('button', { name: 'Clear browser history', exact: true }).click();
  expect(await history.getByRole('button').count()).toBe(0);
  expect(
    await page.evaluate(() => {
      const key = 'pitchcrew:browser-history:v1:writer:default';
      return localStorage.getItem(key);
    }),
  ).toBe('[]');
  await page.keyboard.press('Escape');
});
test('uses native appearance, per-tab audio and external-browser developer controls', async () => {
  state = {
    ...state,
    tabs: state.tabs.map((tab) => ({ ...tab, audible: true, muted: false })),
  };
  const mutedId = state.tabs.find((tab) => tab.title === 'Fixture page')!.id;
  await page.getByRole('button', { name: 'Mute Fixture page', exact: true }).first().click();
  await vi.waitFor(() =>
    expect(nativeCommand).toHaveBeenCalledWith({ kind: 'mute', muted: true, tabId: mutedId }),
  );
  await page.getByRole('button', { name: 'Browser page settings' }).click();
  await page.getByRole('combobox', { name: 'Website appearance' }).click();
  await page.getByRole('option', { name: 'Dark', exact: true }).click();
  await vi.waitFor(() =>
    expect(nativeCommand).toHaveBeenCalledWith({ kind: 'appearance', colorScheme: 'dark' }),
  );
  await page.getByRole('button', { name: 'Open in system browser', exact: true }).click();
  await vi.waitFor(() => expect(nativeCommand).toHaveBeenCalledWith({ kind: 'open-external' }));
  await page.getByRole('button', { name: 'Open developer tools', exact: true }).click();
  await vi.waitFor(() => expect(nativeCommand).toHaveBeenCalledWith({ kind: 'devtools' }));
  await page.keyboard.press('Escape');
});
test('captures, annotates and saves the page and adds the reviewed PNG to the current message draft', async () => {
  const before = await lastMount();
  const messages = host.daemon.service.board.list('message').length;
  await page.getByRole('button', { name: 'Capture browser screenshot', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Browser screenshot', exact: true });
  await dialog.waitFor();
  const canvas = dialog.getByLabel('Annotate browser screenshot', { exact: true });
  await vi.waitFor(async () =>
    expect(await dialog.getByRole('button', { name: 'Save PNG' }).isEnabled()).toBe(true),
  );
  const original = await canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL());
  const bounds = (await canvas.boundingBox())!;
  const draw = async () => {
    await page.mouse.move(bounds.x + 20, bounds.y + 20);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 100, bounds.y + 70, { steps: 6 });
    await page.mouse.up();
  };
  await draw();
  await dialog.getByRole('button', { name: 'Undo mark', exact: true }).click();
  await vi.waitFor(async () =>
    expect(await canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL())).toBe(
      original,
    ),
  );
  await dialog.getByRole('textbox', { name: 'Screenshot note' }).fill('Temporary annotation');
  await dialog.getByRole('button', { name: 'Clear annotations', exact: true }).click();
  expect(await dialog.getByRole('textbox', { name: 'Screenshot note' }).inputValue()).toBe('');
  await draw();
  await dialog
    .getByRole('textbox', { name: 'Screenshot note' })
    .fill('Check the application requirements here.');
  expect(await dialog.getByRole('button', { name: 'Undo mark' }).isEnabled()).toBe(true);
  await dialog.getByRole('button', { name: 'Save PNG', exact: true }).click();
  await dialog.getByRole('status').filter({ hasText: 'Screenshot saved.' }).waitFor();
  const exported = await page.evaluate(async () => {
    const records = (
      window as unknown as { nativeFixture: { artifacts: { kind: string; data: string }[] } }
    ).nativeFixture;
    const artifact = records.artifacts.find((item) => item.kind === 'png')!;
    const image = new Image();
    image.src = `data:image/png;base64,${artifact.data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let marks = 0;
    for (let offset = 0; offset < pixels.length; offset += 4)
      if (pixels[offset] > 180 && pixels[offset + 1] < 100 && pixels[offset + 2] < 100) marks++;
    return { width: image.width, height: image.height, marks };
  });
  expect(exported.width).toBe(700);
  expect(exported.height).toBeGreaterThan(400);
  expect(exported.marks).toBeGreaterThan(30);
  await dialog.getByRole('button', { name: 'Copy image', exact: true }).click();
  await dialog.getByRole('status').filter({ hasText: 'Screenshot copied.' }).waitFor();
  expect(
    await page.evaluate(() => {
      const records = (
        window as unknown as {
          nativeFixture: { copied: string[]; artifacts: { kind: string; data: string }[] };
        }
      ).nativeFixture;
      return records.copied.at(-1) === records.artifacts.find((item) => item.kind === 'png')!.data;
    }),
  ).toBe(true);
  await dialog.getByRole('button', { name: 'Show saved screenshot' }).click();
  await dialog.getByRole('button', { name: 'Attach to message', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByText(/^browser-screenshot-\d+\.png$/).waitFor();
  expect(await lastMount()).toEqual(before);
  expect(host.daemon.service.board.list('message')).toHaveLength(messages);
  await page.getByRole('button', { name: /^Remove browser-screenshot-/ }).click();
});
test('records changing browser frames into playable WebM, saves it and opens the owned floating window', async () => {
  const before = await lastMount();
  const initialCaptures = await page.evaluate(
    () => (window as unknown as { nativeFixture: { captures: number } }).nativeFixture.captures,
  );
  await page.getByRole('button', { name: 'Record browser page', exact: true }).click();
  await page.getByRole('button', { name: 'Stop browser recording', exact: true }).waitFor();
  await vi.waitFor(async () => {
    const count = await page.evaluate(
      () => (window as unknown as { nativeFixture: { captures: number } }).nativeFixture.captures,
    );
    expect(count).toBeGreaterThanOrEqual(initialCaptures + 6);
  });
  await page.getByRole('button', { name: 'Stop browser recording', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Browser recording', exact: true });
  await dialog.waitFor();
  const video = dialog.getByLabel('Review recorded browser page', { exact: true });
  await vi.waitFor(async () =>
    expect(
      await video.evaluate((element) => (element as HTMLVideoElement).readyState),
    ).toBeGreaterThanOrEqual(2),
  );
  expect(await video.evaluate((element) => (element as HTMLVideoElement).videoWidth)).toBe(700);
  const colors = await video.evaluate(async (element) => {
    const video = element as HTMLVideoElement;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    const colors = new Set<string>();
    await video.play();
    return new Promise<number>((resolve) => {
      const deadline = performance.now() + 2000;
      const timer = setInterval(() => {
        context.drawImage(video, 0, 0, 1, 1);
        colors.add(
          Array.from(context.getImageData(0, 0, 1, 1).data)
            .slice(0, 3)
            .join(','),
        );
        if (video.ended || performance.now() > deadline) {
          clearInterval(timer);
          video.pause();
          resolve(colors.size);
        }
      }, 20);
    });
  });
  expect(colors).toBeGreaterThanOrEqual(2);
  await dialog.getByRole('button', { name: 'Save WebM recording' }).click();
  await dialog.getByRole('status').filter({ hasText: 'Recording saved.' }).waitFor();
  const prefix = await page.evaluate(() => {
    const records = (
      window as unknown as { nativeFixture: { artifacts: { kind: string; data: string }[] } }
    ).nativeFixture;
    return atob(records.artifacts.find((item) => item.kind === 'webm')!.data)
      .slice(0, 4)
      .split('')
      .map((char) => char.charCodeAt(0));
  });
  expect(prefix).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  await dialog.getByRole('button', { name: 'Discard recording' }).click();
  await dialog.waitFor({ state: 'hidden' });
  expect(await lastMount()).toEqual(before);
  await page.getByRole('button', { name: 'Open separate browser window' }).click();
  await vi.waitFor(async () =>
    expect(
      await page.evaluate(() =>
        (window as unknown as { nativeFixture: { floating: unknown[] } }).nativeFixture.floating.at(
          -1,
        ),
      ),
    ).toEqual({ id: native.id, open: true }),
  );
});
test('changes the actual browser viewport with device presets, rotation and fill mode', async () => {
  await page.getByRole('button', { name: 'Toggle browser device toolbar', exact: true }).click();
  await page.getByRole('combobox', { name: 'Browser viewport preset', exact: true }).click();
  await page.getByRole('option', { name: 'iPhone 12 Pro', exact: true }).click();
  await vi.waitFor(() => expect(viewport).toEqual({ width: 390, height: 844 }));
  await page.getByRole('button', { name: 'Rotate browser viewport', exact: true }).click();
  await vi.waitFor(() => expect(viewport).toEqual({ width: 844, height: 390 }));
  await page.getByRole('spinbutton', { name: 'Browser viewport width', exact: true }).fill('1024');
  await vi.waitFor(() => expect(viewport).toEqual({ width: 1024, height: 390 }));
  await page.getByRole('combobox', { name: 'Browser viewport preset', exact: true }).click();
  await page.getByRole('option', { name: 'Fill panel', exact: true }).click();
  await page.getByRole('button', { name: 'Hide device toolbar', exact: true }).click();
  await vi.waitFor(async () => {
    const bounds = await page.getByLabel('Native browser page', { exact: true }).boundingBox();
    expect(viewport).toEqual({
      width: Math.round(bounds!.width - 2),
      height: Math.round(bounds!.height - 2),
    });
  });
});
test('blocks human clicks on the painting readonly guest while app menus stay usable, then admits private input', async () => {
  await page.getByRole('button', { name: 'Return to agent', exact: true }).click();
  await page.getByRole('button', { name: 'Take control', exact: true }).waitFor();
  const bounds = await page
    .getByLabel('Native browser page', { exact: true })
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.left + element.clientLeft),
        y: Math.round(rect.top + element.clientTop),
        width: element.clientWidth,
        height: element.clientHeight,
      };
    });
  const view: DesktopBrowserView = {
    token: 'fixture-guest',
    partition: 'persist:fixture',
    contentsId: 99,
    bounds,
    painting: true,
    manual: false,
  };
  const publish = (next: DesktopBrowserView) =>
    page.evaluate((next) => {
      (
        window as unknown as { publishBrowserViews: (next: DesktopBrowserView[]) => void }
      ).publishBrowserViews([next]);
    }, next);
  const clicks = () =>
    page.evaluate(() => {
      const records = (
        window as unknown as { nativeFixture: { guestClicks: number; guardedClicks: number } }
      ).nativeFixture;
      return { guest: records.guestClicks, guarded: records.guardedClicks };
    });
  try {
    await publish(view);
    const guard = page.locator('[data-browser-input-guard="fixture-guest"]');
    await guard.waitFor();
    expect(
      await page.locator('webview').evaluate((element) => getComputedStyle(element).pointerEvents),
    ).toBe('auto');
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    expect(
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-browser-input-guard'),
        point,
      ),
    ).toBe(view.token);
    const before = await clicks();
    await page.mouse.click(point.x, point.y);
    expect(await clicks()).toEqual({ guest: before.guest, guarded: before.guarded + 1 });
    await page.getByRole('button', { name: 'Browser history', exact: true }).click();
    const search = page.getByRole('textbox', { name: 'Search browser history', exact: true });
    await search.fill('Human menu remains interactive');
    expect(await search.inputValue()).toBe('Human menu remains interactive');
    expect(
      await search.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return !!document
          .elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          ?.closest('[data-slot="popover-content"]');
      }),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Take control', exact: true }).click();
    await page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
    const manualBounds = await page
      .getByLabel('Native browser page', { exact: true })
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: Math.round(rect.left + element.clientLeft),
          y: Math.round(rect.top + element.clientTop),
          width: element.clientWidth,
          height: element.clientHeight,
        };
      });
    await publish({ ...view, bounds: manualBounds, painting: false, manual: true });
    await guard.waitFor({ state: 'detached' });
    const manualPoint = {
      x: manualBounds.x + manualBounds.width / 2,
      y: manualBounds.y + manualBounds.height / 2,
    };
    expect(
      await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, manualPoint),
    ).toBe('WEBVIEW');
    await page.mouse.click(manualPoint.x, manualPoint.y);
    expect(await clicks()).toEqual({ guest: before.guest + 1, guarded: before.guarded + 1 });
  } finally {
    await publish({ ...view, bounds: null, painting: false, manual: false });
  }
});
test('preserves a fixed device viewport while visiting Settings and returning to the same browser', async () => {
  await page.getByRole('button', { name: 'Toggle browser device toolbar', exact: true }).click();
  await page.getByRole('combobox', { name: 'Browser viewport preset', exact: true }).click();
  await page.getByRole('option', { name: 'iPhone 12 Pro', exact: true }).click();
  await vi.waitFor(() => expect(viewport).toEqual({ width: 390, height: 844 }));
  await page.evaluate(() =>
    Object.assign(window, { viewportRouteGuest: document.querySelector('webview') }),
  );
  const requests: { width: number; height: number }[] = [];
  const observe = (request: Request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/browser/writer/viewport'
    )
      requests.push(request.postDataJSON() as { width: number; height: number });
  };
  page.on('request', observe);
  let waiting = false;
  let release = () => {};
  const metadata = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    expect(viewport).toEqual({ width: 390, height: 844 });
    await page.route('**/api/browser/writer/native?*', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      waiting = true;
      await metadata;
      await route.fulfill({ json: state });
    });
    await page.goBack();
    await vi.waitFor(() => expect(waiting).toBe(true));
    // Hold metadata beyond the sizing debounce: an unresolved tab must not emit Fill.
    await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 300)));
    expect(viewport).toEqual({ width: 390, height: 844 });
    for (const request of requests) expect(request).toMatchObject({ width: 390, height: 844 });
    release();
    await vi.waitFor(async () =>
      expect(
        await page.getByRole('spinbutton', { name: 'Browser viewport width' }).inputValue(),
      ).toBe('390'),
    );
    expect(
      await page.getByRole('spinbutton', { name: 'Browser viewport height' }).inputValue(),
    ).toBe('844');
    expect(
      await page.getByRole('combobox', { name: 'Browser viewport preset' }).textContent(),
    ).toContain('iPhone 12 Pro');
    expect(
      await page.evaluate(
        () =>
          document.querySelector('webview') ===
          (window as unknown as { viewportRouteGuest: Element }).viewportRouteGuest,
      ),
    ).toBe(true);
    for (const request of requests) expect(request).toMatchObject({ width: 390, height: 844 });
  } finally {
    release();
    page.off('request', observe);
    await page.unroute('**/api/browser/writer/native?*');
  }
  await page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
  const commands = nativeCommand.mock.calls.length;
  await page.getByRole('button', { name: 'Reload page', exact: true }).click();
  await vi.waitFor(() => {
    expect(nativeCommand.mock.calls.length).toBeGreaterThan(commands);
    expect(nativeCommand).toHaveBeenLastCalledWith({ kind: 'reload' });
  });
  expect(viewport).toEqual({ width: 390, height: 844 });
  await page.getByRole('combobox', { name: 'Browser viewport preset', exact: true }).click();
  await page.getByRole('option', { name: 'Fill panel', exact: true }).click();
  await page.getByRole('button', { name: 'Hide device toolbar', exact: true }).click();
  await vi.waitFor(async () => {
    const bounds = await page.getByLabel('Native browser page', { exact: true }).boundingBox();
    expect(viewport).toEqual({
      width: Math.round(bounds!.width - 2),
      height: Math.round(bounds!.height - 2),
    });
  });
}, 30000);
test('stops capturing browser frames when private control is returned to the agent', async () => {
  await page.getByRole('button', { name: 'Record browser page', exact: true }).click();
  await page.getByRole('button', { name: 'Stop browser recording', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Return to agent', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Browser recording', exact: true });
  await review.waitFor();
  const counts = await page.evaluate(() => {
    const records = (window as unknown as { nativeFixture: { captures: number } }).nativeFixture;
    const before = records.captures;
    return new Promise<number[]>((resolve) =>
      setTimeout(() => resolve([before, records.captures]), 350),
    );
  });
  expect(counts[0]).toBe(counts[1]);
  await review.getByRole('button', { name: 'Discard recording' }).click();
  await review.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Take control', exact: true }).click();
  await page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
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
test('keeps the page bounds while a conversation editor opens over it', async () => {
  const body = page.getByLabel('Native browser page', { exact: true });
  const before = await body.boundingBox();
  const mounted = await lastMount();
  await page.getByRole('button', { name: /^Conversation runtime:/ }).click();
  await page.getByRole('button', { name: 'Close chat panel' }).waitFor();
  expect(await body.boundingBox()).toEqual(before);
  expect(await lastMount()).toEqual(mounted);
  await page.getByRole('button', { name: 'Close chat panel' }).click();
  expect(await body.boundingBox()).toEqual(before);
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
test('keeps popup ownership visible and can bring its separate window forward', async () => {
  state = { ...state, tabs: state.tabs.map((tab) => ({ ...tab, window: true })) };
  await page.getByRole('heading', { name: 'Page open in a separate window' }).waitFor();
  await vi.waitFor(async () =>
    expect(await lastMount()).toMatchObject({ width: expect.any(Number) }),
  );
  await page.getByRole('button', { name: 'Show browser window' }).click();
  await vi.waitFor(() =>
    expect(nativeCommand).toHaveBeenCalledWith({
      kind: 'select-tab',
      tabId: state.activeTab,
    }),
  );
  state = { ...state, tabs: state.tabs.map((tab) => ({ ...tab, window: undefined })) };
  await page
    .getByRole('heading', { name: 'Page open in a separate window' })
    .waitFor({ state: 'hidden' });
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
      expect(
        await page
          .locator('[data-slot="toast-title"]')
          .filter({
            hasText: 'Writer needs browser approval',
          })
          .count(),
      ).toBe(0);
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
      const confirmation = page.locator('[data-slot="toast"][data-kind="action"]').filter({
        hasText: 'Browser action approved for this run',
      });
      await confirmation.locator('[data-slot="toast-close"]').click();
      await confirmation.waitFor({ state: 'hidden' });
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
test('keeps the live page mounted under app overlays across native state polls in split and sheet views', async () => {
  await page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
  await vi.waitFor(async () =>
    expect(
      await page.getByRole('button', { name: 'Return to agent', exact: true }).isEnabled(),
    ).toBe(true),
  );
  await page.evaluate(() =>
    Object.assign(window, {
      initialBrowserGuest: document.querySelector('webview'),
    }),
  );
  const assertMounted = async () => {
    await vi.waitFor(async () =>
      expect(await lastPresentation()).toMatchObject({
        bounds: { width: expect.any(Number), height: expect.any(Number) },
      }),
    );
    const mounts = await page.evaluate(() => {
      const records = (window as unknown as { nativeFixture: { mounts: unknown[] } }).nativeFixture;
      const start = records.mounts.length;
      return new Promise<unknown[]>((resolve) => {
        setTimeout(() => resolve(records.mounts.slice(start)), 1500);
      });
    });
    expect(mounts).toEqual([]);
  };
  for (const expanded of [false, true]) {
    if (expanded)
      await page.evaluate(() => {
        document.documentElement.dataset.desktop = 'darwin';
      });
    if (expanded) await page.getByRole('button', { name: 'Expand browser', exact: true }).click();
    await vi.waitFor(async () =>
      expect(await lastPresentation()).toMatchObject({
        bounds: { width: expect.any(Number), height: expect.any(Number) },
      }),
    );
    if (expanded) {
      expect(
        await page
          .locator('.desktop-titlebar')
          .evaluate((element) => getComputedStyle(element).zIndex),
      ).toBe('60');
      expect((await page.locator('[data-desktop-browser-layer]').boundingBox())?.y).toBe(40);
    }
    await vi.waitFor(async () => {
      const bounds = await page
        .getByLabel('Native browser page', { exact: true })
        .evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            x: Math.round(rect.left + element.clientLeft),
            y: Math.round(rect.top + element.clientTop),
            width: element.clientWidth,
            height: element.clientHeight,
          };
        });
      expect(await lastMount()).toEqual(bounds);
    });
    const beforeOverlay = await lastMount();
    await page.getByRole('button', { name: 'Browser page settings' }).click();
    await assertMounted();
    expect(await lastMount()).toEqual(beforeOverlay);
    await page.getByRole('button', { name: 'Manage browser profiles' }).click();
    await page.getByRole('textbox', { name: 'New browser profile name' }).focus();
    await assertMounted();
    expect(
      await page
        .getByRole('textbox', { name: 'New browser profile name' })
        .evaluate((element) => document.activeElement === element),
    ).toBe(true);
    await page.getByRole('button', { name: 'Close profiles' }).click();
    await assertMounted();
    await page.keyboard.press('Escape');
    await vi.waitFor(async () => expect(await lastMount()).not.toBeNull());
    if (expanded)
      await page.getByRole('button', { name: 'Restore split view', exact: true }).click();
    if (expanded)
      await page.evaluate(() => {
        delete document.documentElement.dataset.desktop;
      });
    expect(
      await page.evaluate(
        () =>
          !!document.querySelector('webview') &&
          document.querySelector('webview') ===
            (window as unknown as { initialBrowserGuest: Element }).initialBrowserGuest,
      ),
    ).toBe(true);
  }
}, 20000);
test('keeps the guest under app menus and hides it when the panel closes without releasing control', async () => {
  await page.getByRole('button', { name: 'Browser options', exact: true }).click();
  await vi.waitFor(async () =>
    expect(await lastMount()).toMatchObject({ width: expect.any(Number) }),
  );
  await page.keyboard.press('Escape');
  await vi.waitFor(async () => expect(await lastMount()).not.toBeNull());
  await page.locator('button[aria-controls="agent-browser-panel"]').click();
  await vi.waitFor(async () => expect(await lastMount()).toBeNull());
  expect(host.daemon.service.computer.browsers.list()[0].manual).toBe(true);
});
