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
        tab.id !== state.activeTab
          ? tab
          : value.url.includes('pitchcrew-browser-test.invalid')
            ? {
                ...tab,
                navigationUrl: value.url,
                error: 'Check the address and your connection, then try again.',
                errorDetails: 'getaddrinfo ENOTFOUND pitchcrew-browser-test.invalid',
              }
            : {
                ...tab,
                url: value.url,
                title: 'Fixture page',
                error: undefined,
                navigationUrl: undefined,
                errorDetails: undefined,
              },
      ),
    };
});
const setManual = vi.fn(async () => {});
const subscribeFrames = vi.fn(() => () => {});
let viewport = { width: 1280, height: 800 };
let tabSerial = 1;
const nativeCommand = vi.fn(async (command: NativeBrowserCommand) => {
  if (command.kind === 'reload') {
    const tab = state.tabs.find((tab) => tab.id === state.activeTab);
    if (tab?.navigationUrl) await input({ kind: 'navigate', url: tab.navigationUrl });
  }
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
  if (command.kind === 'move-tab') {
    const moved = state.tabs.find((tab) => tab.id === command.tabId)!;
    const tabs = state.tabs.filter((tab) => tab.id !== command.tabId);
    tabs.splice(command.index, 0, moved);
    state = { ...state, tabs };
  }
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
      picks: 0,
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
        pickElement: async () => {
          records.picks++;
          const canvas = document.createElement('canvas');
          canvas.width = 136;
          canvas.height = 56;
          const context = canvas.getContext('2d')!;
          context.fillStyle = '#6fa8dc';
          context.fillRect(0, 0, canvas.width, canvas.height);
          return {
            data: canvas.toDataURL('image/png').split(',')[1],
            width: canvas.width,
            height: canvas.height,
            url: 'https://example.com/apply',
            title: 'Fictional application',
            label: 'Button “Apply now”',
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
/** Resolves once the panel has sent no page resize for a second. */
const viewportSettled = async (service: typeof host.daemon.service) => {
  let last = Date.now();
  const resize = service.computer.resizeBrowser;
  const spy = vi.spyOn(service.computer, 'resizeBrowser').mockImplementation((...args) => {
    last = Date.now();
    return resize(...args);
  });
  try {
    await vi.waitFor(() => expect(Date.now() - last).toBeGreaterThanOrEqual(1000), {
      timeout: 10000,
      interval: 100,
    });
  } finally {
    spy.mockRestore();
  }
};
const lastMount = async () => {
  const presentation = await lastPresentation();
  return presentation?.bounds;
};
/** Page tools (devices, screenshot, recording, floating) live in Browser page settings. */
const pageSettings = () => page.locator('.browser-settings-tools');
const pageTool = async (name: string) => {
  const settings = page.getByRole('button', { name: 'Browser page settings', exact: true });
  // A closing popover is still visible; the trigger already reports it as collapsed.
  if ((await settings.getAttribute('aria-expanded')) !== 'true') await settings.click();
  await pageSettings().getByRole('button', { name, exact: true }).click();
};
const closePageSettings = async () => {
  const settings = page.getByRole('button', { name: 'Browser page settings', exact: true });
  if ((await settings.getAttribute('aria-expanded')) === 'true')
    await page.keyboard.press('Escape');
  await pageSettings().waitFor({ state: 'hidden' });
};
/**
 * Explicit takeover: the tray offers Take control while an agent works; while it is idle the
 * page is already usable and explicit control lives under Browser options.
 */
const takeControl = async () => {
  const header = page
    .locator('.browser-approvals')
    .getByRole('button', { name: 'Take control', exact: true });
  if (await header.isVisible()) return header.click();
  await page.getByRole('button', { name: 'Browser options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Keep control until I return it', exact: true }).click();
};
/** Control is held, explicitly (Return to agent) or by browsing (the chip says so). */
const controlHeld = () =>
  page.locator('.browser-state-chip:is([data-tone="browsing"], [data-tone="control"])').waitFor();
/**
 * Returns any held control. Control taken by browsing hands back when a run starts; a test
 * releases it now by keeping it explicitly, then using the header's Return to agent.
 */
const returnControl = async () => {
  const header = page.getByRole('button', { name: 'Return to agent', exact: true });
  if (!(await header.isVisible())) {
    await page.getByRole('button', { name: 'Browser options', exact: true }).click();
    await page
      .getByRole('menuitem', { name: 'Keep control until I return it', exact: true })
      .click();
    await header.waitFor();
  }
  await header.click();
};
const controlReleased = () =>
  page.locator('.browser-state-chip:is([data-tone="idle"], [data-tone="working"])').waitFor();
/** The toolbar keeps only a running recording's stop control. */
const stopRecording = () =>
  page
    .locator('.browser-chrome')
    .getByRole('button', { name: 'Stop browser recording', exact: true });

test('uses the native surface and browser controls without screenshot or private-text proxies', async () => {
  await vi.waitFor(async () =>
    expect(await lastMount()).toMatchObject({
      width: expect.any(Number),
      height: expect.any(Number),
    }),
  );
  expect(await page.locator('.browser-screen').count()).toBe(0);
  expect(subscribeFrames).not.toHaveBeenCalled();
  await takeControl();
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
test('preserves a typed address when the first native tab hydrates under the same control lease', async () => {
  const original = structuredClone(state);
  if (!(await page.getByRole('button', { name: 'Return to agent', exact: true }).isVisible()))
    await takeControl();
  await page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
  let held = false;
  let release = () => {};
  const metadata = new Promise<void>((resolve) => {
    release = resolve;
  });
  let response: Promise<void> | undefined;
  const pattern = '**/api/browser/writer/native?*';
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await page.route(pattern, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    held = true;
    response = metadata.then(() => route.fulfill({ json: state }));
    return response;
  });
  try {
    await page.goBack();
    await vi.waitFor(() => expect(held).toBe(true));
    const address = page.getByRole('textbox', { name: 'Browser address' });
    await address.fill('https://example.com/typed-before-tab-hydration');
    const manualCalls = setManual.mock.calls.length;
    state = {
      ...original,
      tabs: original.tabs.map((tab) =>
        tab.id === original.activeTab
          ? { ...tab, title: '', url: 'about:blank', navigationUrl: undefined }
          : tab,
      ),
    };
    await page.evaluate((next) => {
      (
        window as unknown as { publishBrowserState: (next: NativeBrowserState) => void }
      ).publishBrowserState(next);
    }, state);
    await vi.waitFor(async () =>
      expect(
        await page.locator('.browser-tab[data-active="true"] .browser-tab-select').textContent(),
      ).toBe('New tab'),
    );
    expect(await address.inputValue()).toBe('https://example.com/typed-before-tab-hydration');
    await page.getByRole('button', { name: 'Go to address', exact: true }).click();
    await vi.waitFor(() =>
      expect(input).toHaveBeenCalledWith({
        kind: 'navigate',
        url: 'https://example.com/typed-before-tab-hydration',
      }),
    );
    expect(setManual.mock.calls.length).toBe(manualCalls);
  } finally {
    state = original;
    release();
    await response;
    await page.unroute(pattern);
    await page.evaluate((next) => {
      (
        window as unknown as { publishBrowserState: (next: NativeBrowserState) => void }
      ).publishBrowserState(next);
    }, original);
    await page.getByRole('textbox', { name: 'Browser address' }).press('Escape');
  }
}, 30000);
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
test('keeps newer native events when a delayed command response arrives', async () => {
  const before = structuredClone(state);
  const stale = { ...before, warning: 'Delayed command response.' };
  let started = false;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  nativeCommand.mockImplementationOnce(async () => {
    started = true;
    await gate;
    return stale;
  });
  // Prevent the next poll from concealing a stale command response.
  await page.route('**/api/browser/writer/native?*', (route) =>
    route.request().method() === 'GET' ? route.abort() : route.continue(),
  );
  try {
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await vi.waitFor(() => expect(started).toBe(true));
    state = {
      ...state,
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeTab ? { ...tab, title: 'Newer native page' } : tab,
      ),
    };
    await page.evaluate((next) => {
      (
        window as unknown as { publishBrowserState: (next: NativeBrowserState) => void }
      ).publishBrowserState(next);
    }, state);
    // A lone tab has no pill, so read the tab's label rather than its visibility.
    const title = page.locator('.browser-tab-select', { hasText: 'Newer native page' });
    await title.waitFor({ state: 'attached' });
    release();
    await page.getByText(stale.warning, { exact: true }).waitFor();
    expect(await title.count()).toBe(1);
  } finally {
    release();
    state = before;
    await page.unroute('**/api/browser/writer/native?*');
    await page.getByText(stale.warning, { exact: true }).waitFor({ state: 'hidden' });
  }
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
    .filter({ hasText: 'example.com/live-events' })
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
  // Clearing asks once, in a quiet row, before removing both lists.
  await page.getByRole('button', { name: 'Clear browser history…', exact: true }).click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect.poll(() => history.getByRole('button').count()).toBe(0);
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
  await page
    .getByRole('group', { name: 'Website appearance' })
    .getByRole('button', { name: 'Dark', exact: true })
    .click();
  await vi.waitFor(() =>
    expect(nativeCommand).toHaveBeenCalledWith({ kind: 'appearance', colorScheme: 'dark' }),
  );
  await page.getByRole('button', { name: 'Open developer tools', exact: true }).click();
  await vi.waitFor(() => expect(nativeCommand).toHaveBeenCalledWith({ kind: 'devtools' }));
  await page.keyboard.press('Escape');
  // The address bar offers Open in system browser beside an unedited web address.
  await page.getByRole('button', { name: 'Open page in system browser', exact: true }).click();
  await vi.waitFor(() => expect(nativeCommand).toHaveBeenCalledWith({ kind: 'open-external' }));
});
test('moves tabs by drag, keyboard and the tab menu without selecting them', async () => {
  if (state.tabs.length < 2) {
    await page.getByRole('button', { name: 'New tab', exact: true }).click();
    await vi.waitFor(() => expect(state.tabs.length).toBeGreaterThan(1));
  }
  const strip = page.getByRole('tablist', { name: 'Browser tabs' });
  const order = async () =>
    (await strip
      .locator('.browser-tab')
      .evaluateAll((tabs) =>
        tabs.map((tab) => tab.querySelector('[role="tab"]')!.getAttribute('title')),
      )) as string[];
  const ids = () => state.tabs.map((tab) => tab.id);
  const [first, second] = ids();
  const active = state.activeTab;
  // The tab menu moves the right-clicked tab, never selecting it.
  await strip.locator('.browser-tab').nth(1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Move tab left', exact: true }).click();
  await vi.waitFor(() =>
    expect(nativeCommand).toHaveBeenLastCalledWith({ kind: 'move-tab', tabId: second, index: 0 }),
  );
  await vi.waitFor(async () => expect((await order()).length).toBe(state.tabs.length));
  expect(ids().slice(0, 2)).toEqual([second, first]);
  expect(state.activeTab).toBe(active);
  // Control+Shift+Page Down moves the focused tab right.
  await strip.locator('.browser-tab[data-active="true"] [role="tab"]').focus();
  const focusedId = state.activeTab;
  const from = ids().indexOf(focusedId);
  const to = from === state.tabs.length - 1 ? from - 1 : from + 1;
  await page.keyboard.press(
    from === state.tabs.length - 1 ? 'Control+Shift+PageUp' : 'Control+Shift+PageDown',
  );
  await vi.waitFor(() =>
    expect(nativeCommand).toHaveBeenLastCalledWith({
      kind: 'move-tab',
      tabId: focusedId,
      index: to,
    }),
  );
  await expect
    .poll(() => page.locator('output[aria-live="polite"]').filter({ hasText: 'Position' }).count())
    .toBeGreaterThan(0);
  // Whole-tab dragging past its neighbour moves it there.
  const before = ids();
  const source = (await strip.locator('.browser-tab').nth(0).boundingBox())!;
  const target = (await strip.locator('.browser-tab').nth(1).boundingBox())!;
  await page.mouse.move(source.x + source.width / 3, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 3 + 12, source.y + source.height / 2, {
    steps: 4,
  });
  await page.mouse.move(target.x + target.width - 4, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
  await vi.waitFor(() => expect(ids().slice(0, 2)).toEqual([before[1], before[0]]));
  expect(nativeCommand).toHaveBeenLastCalledWith({ kind: 'move-tab', tabId: before[0], index: 1 });
}, 30000);
test('captures, annotates and saves the page and adds the reviewed PNG to the current message draft', async () => {
  const before = await lastMount();
  const messages = host.daemon.service.board.list('message').length;
  await pageTool('Capture browser screenshot');
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
  await closePageSettings();
  await page.getByRole('button', { name: /^Remove browser-screenshot-/ }).click();
});
test('picks an element into a labelled review and attaches it to the draft by name', async () => {
  const messages = host.daemon.service.board.list('message').length;
  await page.getByRole('button', { name: 'Pick an element to attach', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Picked element', exact: true });
  await dialog.waitFor();
  expect(await dialog.innerText()).toContain('Button “Apply now” on Fictional application.');
  await vi.waitFor(async () =>
    expect(await dialog.getByRole('button', { name: 'Attach to message' }).isEnabled()).toBe(true),
  );
  await dialog.getByRole('button', { name: 'Attach to message', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByText(/^browser-element-button-apply-now-\d+\.png$/).waitFor();
  expect(host.daemon.service.board.list('message')).toHaveLength(messages);
  await closePageSettings();
  await page.getByRole('button', { name: /^Remove browser-element-/ }).click();
});
test('records changing browser frames into playable WebM, saves it and opens the owned floating window', async () => {
  const before = await lastMount();
  const initialCaptures = await page.evaluate(
    () => (window as unknown as { nativeFixture: { captures: number } }).nativeFixture.captures,
  );
  await pageTool('Record browser page');
  await closePageSettings();
  await stopRecording().waitFor();
  await vi.waitFor(async () => {
    const count = await page.evaluate(
      () => (window as unknown as { nativeFixture: { captures: number } }).nativeFixture.captures,
    );
    expect(count).toBeGreaterThanOrEqual(initialCaptures + 6);
  });
  await stopRecording().click();
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
  await pageTool('Open separate browser window');
  await closePageSettings();
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
  await pageTool('Toggle browser device toolbar');
  await closePageSettings();
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
test('blocks human clicks on the painting readonly guest, takes control from that press while idle, keeps app menus usable and admits private input', async () => {
  await returnControl();
  await controlReleased();
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
    // The agent is idle: the press starts browsing by taking control, never by clicking the page.
    await controlHeld();
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
    await controlHeld();
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
  await pageTool('Toggle browser device toolbar');
  await closePageSettings();
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
  await controlHeld();
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
  await pageTool('Record browser page');
  await closePageSettings();
  await stopRecording().waitFor();
  await returnControl();
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
  await takeControl();
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
  await page
    .locator('.browser-page-error')
    .getByRole('button', { name: 'Retry page', exact: true })
    .click();
  state = { ...state, tabs: state.tabs.map((tab) => ({ ...tab, error: undefined })) };
});
test('keeps a failed blank tab address and explanation across switches, retries and successful replacement', async () => {
  const saved = structuredClone(state);
  try {
    await page.getByRole('button', { name: 'New browser tab', exact: true }).click();
    const failedUrl = 'https://pitchcrew-browser-test.invalid/';
    const address = page.getByRole('textbox', { name: 'Browser address' });
    await address.fill(failedUrl);
    await address.press('Enter');
    const error = page.locator('.browser-page-error');
    await error.waitFor();
    expect(await address.inputValue()).toBe(failedUrl);
    expect(await page.getByRole('heading', { name: 'New tab', exact: true }).count()).toBe(0);
    await error.getByText('Technical details', { exact: true }).click();
    await error
      .getByText('getaddrinfo ENOTFOUND pitchcrew-browser-test.invalid', { exact: true })
      .waitFor();
    const failedIndex = state.tabs.findIndex((tab) => tab.id === state.activeTab);
    const otherIndex = state.tabs.findIndex((tab) => tab.id !== state.activeTab);
    await page.locator('.browser-tab-select').nth(otherIndex).click();
    await error.waitFor({ state: 'hidden' });
    expect(await address.inputValue()).not.toBe(failedUrl);
    await page.locator('.browser-tab-select').nth(failedIndex).click();
    await error.waitFor();
    expect(await address.inputValue()).toBe(failedUrl);
    const before = input.mock.calls.length;
    await error.getByRole('button', { name: 'Retry page', exact: true }).click();
    await vi.waitFor(() => expect(input.mock.calls.length).toBeGreaterThan(before));
    expect(input).toHaveBeenLastCalledWith({ kind: 'navigate', url: failedUrl });
    expect(await address.inputValue()).toBe(failedUrl);
    await address.fill('https://example.com/recovered');
    await address.press('Enter');
    await error.waitFor({ state: 'hidden' });
    expect(await address.inputValue()).toBe('https://example.com/recovered');
    await page.locator('.browser-tab-select').nth(otherIndex).click();
    await vi.waitFor(async () =>
      expect(await address.inputValue()).not.toBe('https://example.com/recovered'),
    );
    await page.locator('.browser-tab-select').nth(failedIndex).click();
    await vi.waitFor(async () =>
      expect(await address.inputValue()).toBe('https://example.com/recovered'),
    );
    expect(await error.count()).toBe(0);
  } finally {
    state = saved;
  }
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
  await page.getByRole('heading', { name: 'New tab', exact: true }).waitFor();
  await vi.waitFor(async () => expect(await lastMount()).toBeNull());
  // The address field above is the blank tab's action; the page adds no button for it.
  expect(
    await page
      .locator('.browser-placeholder')
      .getByRole('button', { name: 'Enter an address', exact: true })
      .count(),
  ).toBe(0);
  const address = page.getByRole('textbox', { name: 'Browser address' });
  expect(await address.getAttribute('readonly')).toBeNull();
  await address.focus();
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
/** Which title parts are clipped, and the gap from the title's last glyph to its chevron. */
const approvalTitleLayout = (review: import('playwright').Locator) =>
  review.evaluate((element) => {
    const parts = [...element.querySelectorAll<HTMLElement>('.browser-approval-text')];
    const object = element.querySelector('.browser-approval-object')!;
    const end = (object.lastElementChild ?? object).getBoundingClientRect();
    const more = element.querySelector('.browser-approval-more')!.getBoundingClientRect();
    const value = element.querySelector('.browser-approval-value')?.getBoundingClientRect();
    return {
      clipped: parts
        .filter((part) => part.scrollWidth > part.clientWidth)
        .map((part) => (part.closest('.browser-approval-value') ? 'value' : 'target')),
      gap: more.left - end.right,
      overlap: value ? value.right > object.getBoundingClientRect().left : false,
    };
  });
const publishGuest = (bounds: DesktopBrowserView['bounds']) =>
  page.evaluate((bounds) => {
    (
      window as unknown as { publishBrowserViews: (next: DesktopBrowserView[]) => void }
    ).publishBrowserViews([
      {
        token: 'fixture-guest',
        partition: 'persist:fixture',
        contentsId: 99,
        bounds,
        painting: !!bounds,
        manual: false,
      },
    ]);
  }, bounds);
test('keeps native approval evidence stable while requests appear, expand and resolve', async () => {
  const release = page.getByRole('button', { name: 'Return to agent', exact: true });
  if (await release.isVisible()) await release.click();
  const service = host.daemon.service;
  const scope = { runId: 'native-approval-layout', roleId: 'writer', cardId: null };
  service.computer.bindBrowser({ ...scope, threadId: 'writer' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const body = page.getByLabel('Native browser page', { exact: true });
  await body.waitFor();
  // The daemon serves each waiting request's element box; the overlay rings it on the page.
  const target = vi
    .spyOn(service.computer, 'target')
    .mockReturnValue({ x: 20, y: 30, width: 120, height: 32 });
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
      // A short title is never shortened while the line has room, and its chevron follows it.
      const title = await approvalTitleLayout(review);
      expect(title.clipped).toEqual([]);
      expect(title.gap).toBeGreaterThanOrEqual(0);
      expect(title.gap).toBeLessThanOrEqual(16);
      if (!index) {
        // Present the guest at the page's place so the overlay can ring the element on it.
        const box = (await body.boundingBox())!;
        await publishGuest({ x: box.x, y: box.y, width: box.width, height: box.height });
        const ring = page.locator('.browser-approval-target');
        await ring.waitFor();
        const placed = (await ring.boundingBox())!;
        expect(Math.round(placed.x - box.x)).toBe(16);
        expect(Math.round(placed.width)).toBe(128);
      }
      expect(
        await page
          .locator('[data-slot="toast-title"]')
          .filter({
            hasText: 'Writer asks to use the browser',
          })
          .count(),
      ).toBe(0);
      expect((await body.boundingBox())?.height).toBe(before?.height);
      await review.getByRole('button', { name: /^Details: / }).click();
      await page.locator('.browser-evidence-popover').waitFor();
      if (!index)
        await page.screenshot({ path: `/tmp/pitchcrew-browser-approval-${size.width}.png` });
      await expect.poll(async () => (await body.boundingBox())?.height).toBe(before?.height);
      await page.keyboard.press('Escape');
      await page.locator('.browser-evidence-popover').waitFor({ state: 'hidden' });
      expect(service.board.get<ComputerApproval>('computer_approval', approval.id).status).toBe(
        'pending',
      );
      expect((await service.snapshot({ workspace: true })).computerApprovals).toContainEqual(
        approval,
      );
      await review.getByRole('button', { name: 'Approve opening', exact: true }).click();
      await review.waitFor({ state: 'hidden' });
      await page.locator('.browser-approval-target').waitFor({ state: 'detached' });
      if (!index) await publishGuest(null);
      // The tray shows the outcome; no toast covers the next request's decision.
      expect(
        await page
          .locator('[data-slot="toast"]')
          .filter({ hasText: 'Browser action approved for this run' })
          .count(),
      ).toBe(0);
      await service.computer.execute(
        scope.runId,
        approval.id,
        new AbortController().signal,
        () => {},
      );
      expect((await body.boundingBox())?.height).toBe(before?.height);
    }
  }
  target.mockRestore();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await service.computer.stop(scope.runId);
  // Let the header settle on Idle so explicit control comes from Browser options.
  await page.locator('.browser-state-chip[data-tone="idle"]').waitFor();
  await takeControl();
}, 30000);
test('shortens a long typed value before the target at the default panel width', async () => {
  // The previous journey ends holding control; the agent can only ask once it is returned.
  await returnControl();
  const service = host.daemon.service;
  const scope = { runId: 'native-title-layout', roleId: 'writer', cardId: null };
  service.computer.bindBrowser({ ...scope, threadId: 'writer' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByLabel('Native browser page', { exact: true }).waitFor();
  // The reloaded panel must know the run before its request can appear in the tray, and must
  // have settled its size: a resize voids a pending request.
  await page.locator('.browser-state-chip[data-tone="working"]').waitFor({ timeout: 10000 });
  await viewportSettled(service);
  const slot = page.locator('.browser-state-slot');
  const working = (await slot.boundingBox())!.width;
  const approval = await service.computer.request(
    scope,
    {
      kind: 'fill',
      selector: '#cover',
      value: 'A fictional cover letter answer that runs far longer than the tray line can hold',
    },
    'Answer the fictional cover letter question',
  );
  const review = page.getByRole('region', { name: 'Pending browser action', exact: true });
  await review.waitFor();
  // The chip's slot holds its width from Working to Needs your OK, so the tabs never move.
  expect((await slot.boundingBox())!.width).toBe(working);
  const title = await approvalTitleLayout(review);
  // The value may give way; the target never, and the parts never overlap.
  expect(title.clipped).not.toContain('target');
  expect(title.overlap).toBe(false);
  expect(title.gap).toBeGreaterThanOrEqual(0);
  expect(title.gap).toBeLessThanOrEqual(16);
  service.computer.decide(approval.id, false);
  await review.waitFor({ state: 'hidden' });
  await service.computer.stop(scope.runId);
  await page.locator('.browser-state-chip[data-tone="idle"]').waitFor();
  await takeControl();
});
test('keeps the live page mounted under app overlays across native state polls in split and sheet views', async () => {
  await page
    .locator('.browser-approvals')
    .getByRole('button', { name: 'Return to agent', exact: true })
    .waitFor();
  await vi.waitFor(async () =>
    expect(
      await page
        .locator('.browser-approvals')
        .getByRole('button', { name: 'Return to agent', exact: true })
        .isEnabled(),
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
    if (expanded) await page.getByRole('button', { name: 'Back to chat', exact: true }).click();
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
