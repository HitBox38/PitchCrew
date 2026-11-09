import { chromium, type Browser, type Locator, type Page } from 'playwright';
import {
  defaultCapabilities,
  type Card,
  type ComputerApproval,
  type Role,
  type BrowserInput,
} from '@pitchcrew/core';
import type {
  DesktopBrowserView,
  NativeBrowserCommand,
  NativeBrowserState,
} from '../../core/src/native-browser.ts';
import type { BrowserProfilesState } from '../../core/src/browser-profiles.ts';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { setup, cleanup } from './helpers/daemon.ts';

/* The browser panel of a job conversation: page tools in Page settings, the fixed approval tray,
 * site access, private control, Packet | Browser and the expanded view. It drives the same fake
 * native browser as browser-native.test.ts, which covers the agent DM panel's page tools in depth. */

const native = {
  id: '6f0c3f5e-2b8a-4c55-9d43-3a1f0c7e9b21',
  ownerId: '0d4b1e57-7a3c-4f8e-8c2d-5e6f7a8b9c10',
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
let card: Card;
let thread: string;
let runSerial = 0;
let scope: { runId: string; roleId: 'writer'; cardId: string };
let viewport = { width: 1280, height: 800 };
const input = vi.fn(async (_value: BrowserInput) => {});
const setManual = vi.fn(async (_manual: boolean) => {});
const nativeCommand = vi.fn(async (_command: NativeBrowserCommand) => state);
const resize = vi.fn(async (size: { width: number; height: number }) => {
  viewport = size;
  return true;
});

beforeAll(async () => {
  host = await setup(23960, false, {
    browserLaunch: async () => ({
      native,
      nativeState: async () => state,
      nativeCommand,
      setManual,
      subscribeFrames: () => () => {},
      input,
      getViewport: () => viewport,
      resize,
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
    'Clay native UI fixture',
  );
  card = service.createCard({ company: 'Clay Fixture Company', title: 'Product Engineer' });
  thread = service.createConversation({
    title: 'Clay browser job',
    participants: ['writer'],
    cardId: card.id,
  }).id;
  await service.computer.openBrowser('writer', thread, card.id);
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(({ ownerId }) => {
    const records = {
      mounts: [] as { id: string; bounds: unknown }[],
      captures: 0,
    };
    const profiles: BrowserProfilesState = {
      profiles: [{ id: 'default', name: 'Default' }],
      selectedId: 'default',
      currentId: 'default',
    };
    Object.assign(window, {
      nativeFixture: records,
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
        saveArtifact: async (kind: 'png' | 'webm') => `/tmp/fictional-clay-artifact.${kind}`,
        copyCapture: async () => {},
        revealArtifact: async () => {},
        floating: async () => {},
        identify: async () => ownerId,
        views: async (): Promise<DesktopBrowserView[]> => [],
        registerView: async () => {},
        subscribeViews: () => () => {},
        subscribeState: () => () => {},
        profiles: async () => structuredClone(profiles),
        focusPage: async () => {},
        focusControls: async () => {},
        mount: async (id: string, bounds: unknown) => {
          records.mounts.push({ id, bounds });
        },
        find: async () => {},
        subscribeShortcuts: () => () => {},
      },
    });
  }, native);
  await page.goto(`${host.daemon.url}/chat/${thread}`, { waitUntil: 'domcontentloaded' });
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

const lastMount = () =>
  page.evaluate(
    () =>
      (
        window as unknown as { nativeFixture: { mounts: { bounds: unknown }[] } }
      ).nativeFixture.mounts.at(-1)?.bounds,
  );
const body = () => page.getByLabel('Native browser page', { exact: true });
const tray = () => page.locator('.browser-approvals[data-reserved]');
const chrome = () => page.locator('.browser-chrome');
const height = async (locator: Locator) => (await locator.boundingBox())?.height;
/** The guest bounds the renderer would mount for the page box (content box in viewport pixels). */
const pageBounds = () =>
  body().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.left + element.clientLeft),
      y: Math.round(rect.top + element.clientTop),
      width: element.clientWidth,
      height: element.clientHeight,
    };
  });
/** Waits until the fake native viewport follows the page box, so later requests are not expired
 * by a pending resize. */
const settled = async () => {
  await vi.waitFor(
    async () => {
      const size = await body().evaluate((element) => ({
        width: (element as HTMLElement).offsetWidth - 2,
        height: (element as HTMLElement).offsetHeight - 2,
      }));
      expect(viewport).toEqual(size);
      expect(await lastMount()).toEqual(await pageBounds());
    },
    { timeout: 5000 },
  );
};
/** The control action lives at the end of the reserved tray, never in the header. */
const headerControl = (name: string) =>
  page.locator('.browser-approvals').getByRole('button', { name, exact: true });
/** Tray Take control while a run works; while idle, explicit control is in Browser options. */
const takeControl = async () => {
  if (await headerControl('Take control').isVisible()) await headerControl('Take control').click();
  else {
    await page.getByRole('button', { name: 'Browser options', exact: true }).click();
    await page
      .getByRole('menuitem', { name: 'Keep control until I return it', exact: true })
      .click();
  }
  await headerControl('Return to agent').waitFor();
  await vi.waitFor(async () =>
    expect(await headerControl('Return to agent').isEnabled()).toBe(true),
  );
};
const returnControl = async () => {
  await headerControl('Return to agent').click();
  await page.locator('.browser-state-chip:is([data-tone="idle"], [data-tone="working"])').waitFor();
};
/** Binds a fresh agent run to this job's browser and reloads so the panel reserves the tray. */
const bindRun = async (mode: 'supervised' | 'autonomous' = 'supervised') => {
  const service = host.daemon.service;
  if (scope) await service.computer.stop(scope.runId);
  scope = { runId: `clay-native-run-${++runSerial}`, roleId: 'writer', cardId: card.id };
  service.computer.bindBrowser({ ...scope, threadId: thread, mode });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await body().waitFor();
  await tray().waitFor();
};
const request = () =>
  host.daemon.service.computer.request(
    scope,
    { kind: 'navigate', url: 'https://example.com/apply' },
    'Inspect the fictional application form',
  );
const approvalStatus = (id: string) =>
  host.daemon.service.board.get<ComputerApproval>('computer_approval', id).status;
const consume = (id: string) =>
  host.daemon.service.computer.execute(scope.runId, id, new AbortController().signal, () => {});

test('lists the page tools in Page settings and keeps only a running recording on the toolbar', async () => {
  const tools = [
    'Toggle browser device toolbar',
    'Capture browser screenshot',
    'Record browser page',
    'Open separate browser window',
  ];
  for (const name of tools)
    expect(await chrome().getByRole('button', { name, exact: true }).count()).toBe(0);
  // Picking an element is a toolbar toggle beside Find.
  expect(
    await chrome().getByRole('button', { name: 'Pick an element to attach', exact: true }).count(),
  ).toBe(1);
  await takeControl();
  const settings = page.getByRole('button', { name: 'Browser page settings', exact: true });
  const panel = page.locator('.browser-settings-tools');
  await settings.click();
  await panel.waitFor();
  for (const name of tools)
    expect(await panel.getByRole('button', { name, exact: true }).isVisible()).toBe(true);
  for (const name of tools)
    expect(await chrome().getByRole('button', { name, exact: true }).count()).toBe(0);

  await panel.getByRole('button', { name: 'Capture browser screenshot', exact: true }).click();
  const screenshot = page.getByRole('dialog', { name: 'Browser screenshot', exact: true });
  await screenshot.waitFor();
  // Escape reaches the dialog once it has taken focus from the settings popover.
  await expect
    .poll(() => screenshot.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  await page.keyboard.press('Escape');
  await screenshot.waitFor({ state: 'hidden' });
  if (await panel.isVisible()) await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });

  const preset = page.getByRole('combobox', { name: 'Browser viewport preset', exact: true });
  await settings.click();
  await panel.getByRole('button', { name: 'Toggle browser device toolbar', exact: true }).click();
  await preset.waitFor();
  expect(
    await panel
      .getByRole('button', { name: 'Toggle browser device toolbar', exact: true })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  await panel.getByRole('button', { name: 'Toggle browser device toolbar', exact: true }).click();
  await preset.waitFor({ state: 'hidden' });
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });

  await settings.click();
  await panel.getByRole('button', { name: 'Record browser page', exact: true }).click();
  await panel.getByRole('button', { name: 'Stop browser recording', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  const stop = chrome().getByRole('button', { name: 'Stop browser recording', exact: true });
  expect(await stop.isVisible()).toBe(true);
  expect(
    await chrome()
      .getByRole('button')
      .filter({ hasText: /^Stop recording$/ })
      .count(),
  ).toBe(1);
  for (const name of tools)
    expect(await chrome().getByRole('button', { name, exact: true }).count()).toBe(0);
  await stop.click();
  const review = page.getByRole('dialog', { name: 'Browser recording', exact: true });
  await review.waitFor();
  await review.getByRole('button', { name: 'Discard recording', exact: true }).click();
  await review.waitFor({ state: 'hidden' });
  expect(await stop.count()).toBe(0);
  await returnControl();
}, 30000);

test('keeps the compact approval tray and page box fixed while requests appear, open details and resolve', async () => {
  await bindRun();
  for (const size of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await settled();
    const trayHeight = await height(tray());
    const pageBox = await body().boundingBox();
    expect(trayHeight).toBeGreaterThan(0);
    const steady = async () => {
      await expect.poll(() => height(tray())).toBe(trayHeight);
      expect(await body().boundingBox()).toEqual(pageBox);
    };
    await tray().getByText('appear here.', { exact: false }).waitFor();
    const approval = await request();
    const review = tray().getByRole('region', { name: 'Pending browser action', exact: true });
    await review.waitFor();
    await steady();
    if (size.width > 1000) {
      // Expanding to look closer keeps the inspected page size, so the request stays valid.
      const inspected = { ...viewport };
      await page.getByRole('button', { name: 'Expand browser', exact: true }).click();
      await page.getByRole('button', { name: 'Back to chat', exact: true }).waitFor();
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(viewport).toEqual(inspected);
      expect(approvalStatus(approval.id)).toBe('pending');
      // Approving while expanded keeps that size until the agent carries the action out.
      await page
        .locator('.browser-expanded-side')
        .getByRole('button', { name: 'Approve opening', exact: true })
        .click();
      await vi.waitFor(() => expect(approvalStatus(approval.id)).toBe('approved'));
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(viewport).toEqual(inspected);
      expect(approvalStatus(approval.id)).toBe('approved');
      await consume(approval.id);
      await page.getByRole('button', { name: 'Back to chat', exact: true }).click();
      await steady();
      continue;
    }
    expect(
      await review
        .locator('.browser-approval-body')
        .evaluate((element) => element.scrollHeight <= element.clientHeight),
    ).toBe(true);
    const details = review.getByRole('button', { name: /^Details: / });
    await details.click();
    const evidence = page.locator('.browser-evidence-popover');
    await evidence.waitFor();
    await steady();
    await page.keyboard.press('Escape');
    await evidence.waitFor({ state: 'hidden' });
    await steady();
    expect(approvalStatus(approval.id)).toBe('pending');
    await review.getByRole('button', { name: 'Approve opening', exact: true }).click();
    await review.waitFor({ state: 'hidden' });
    expect(approvalStatus(approval.id)).toBe('approved');
    await steady();
    await consume(approval.id);
    await steady();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}, 30000);

test('approves on Control/Command+Enter from the panel, never from a field that used the keystroke', async () => {
  await bindRun();
  await settled();
  const shortcut = (await page.evaluate(() => /Mac|iPhone|iPad/.test(navigator.platform)))
    ? 'Meta+Enter'
    : 'Control+Enter';
  const first = await request();
  const review = tray().getByRole('region', { name: 'Pending browser action', exact: true });
  await review.waitFor();
  // In the expanded view's message box the keystroke is the box's; the request stays waiting.
  await page.getByRole('button', { name: 'Expand browser', exact: true }).click();
  const box = page.locator('.browser-expanded-side .browser-reply-input');
  await box.fill('Fictional note for later');
  await box.press(shortcut);
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(approvalStatus(first.id)).toBe('pending');
  await box.fill('');
  await page.getByRole('button', { name: 'Back to chat', exact: true }).click();
  // From a non-field control in the panel, it approves the waiting request.
  await review.getByRole('button', { name: /^Details: / }).focus();
  await page.keyboard.press(shortcut);
  await vi.waitFor(() => expect(approvalStatus(first.id)).toBe('approved'));
  await consume(first.id);
}, 30000);
test('offers task site grants from a Site access popover without growing the tray', async () => {
  await bindRun('autonomous');
  await settled();
  const trayHeight = await height(tray());
  const approval = await request();
  const review = tray().getByRole('region', { name: 'Pending browser action', exact: true });
  await review.waitFor();
  await expect.poll(() => height(tray())).toBe(trayHeight);
  await review.getByRole('button', { name: /^Site access/ }).click();
  const browse = page.getByRole('button', { name: 'Allow browsing for this task', exact: true });
  const prepare = page.getByRole('button', {
    name: 'Allow preparation for this task',
    exact: true,
  });
  await browse.waitFor();
  expect(await prepare.isVisible()).toBe(true);
  expect(await page.locator('.clay-site-popover').getByText('example.com').count()).toBe(1);
  expect(await height(tray())).toBe(trayHeight);
  await browse.click();
  await vi.waitFor(() => expect(approvalStatus(approval.id)).toBe('approved'));
  await review.waitFor({ state: 'hidden' });
  expect(
    host.daemon.service.computer.browsers.list().find((session) => session.runId === scope.runId)
      ?.explorationSites,
  ).toEqual(['https://example.com']);
  await expect.poll(() => height(tray())).toBe(trayHeight);
  await consume(approval.id);
}, 20000);

test('shows private control over the page and in the reserved tray without resizing it', async () => {
  await bindRun();
  await settled();
  const trayHeight = await height(tray());
  const slot = page.locator('.browser-state-slot');
  const working = (await slot.boundingBox())!.width;
  await takeControl();
  // One state chip says who has the page (ochre: the run waits on you); the tray says the agent
  // waits and offers the return.
  const chip = page.locator('.browser-state-chip[data-tone="held"]');
  await chip.waitFor();
  expect(await chip.textContent()).toContain('You have control');
  // The widest run state fits the reserved slot, so a takeover never moves the tabs.
  expect((await slot.boundingBox())!.width).toBe(working);
  await tray().getByText('waits until you return the page', { exact: false }).waitFor();
  expect(
    await page
      .locator('.browser-panel-heading')
      .getByRole('button', { name: 'Return to agent', exact: true })
      .count(),
  ).toBe(0);
  await expect.poll(() => height(tray())).toBe(trayHeight);
  expect(setManual).toHaveBeenLastCalledWith(true);
  await headerControl('Return to agent').click();
  await headerControl('Take control').waitFor();
  await chip.waitFor({ state: 'hidden' });
  await expect.poll(() => height(tray())).toBe(trayHeight);
  await vi.waitFor(() => expect(setManual).toHaveBeenLastCalledWith(false));
  expect(host.daemon.service.computer.browsers.list()[0].manual).toBe(false);
});

test('names stopped automatic filling and lets the user fill it or continue with each step asked', async () => {
  state = { ...state, warning: 'Fictional preparation hit a website write request.' };
  const notice = page.getByRole('status', { name: 'Automatic preparation', exact: true });
  await notice.waitFor();
  expect(await notice.getByText('Stopped automatic filling', { exact: true }).count()).toBe(1);
  await notice.getByRole('button', { name: 'I’ll fill it', exact: true }).click();
  await headerControl('Return to agent').waitFor();
  await notice.getByRole('button', { name: 'I’ll fill it', exact: true }).waitFor({
    state: 'hidden',
  });
  await notice.getByRole('button', { name: 'Continue, ask each step', exact: true }).click();
  await notice.waitFor({ state: 'hidden' });
  state = { ...state, warning: undefined };
  await vi.waitFor(async () =>
    expect(await headerControl('Return to agent').isEnabled()).toBe(true),
  );
  await returnControl();
});

test('switches between Packet and Browser without resizing or releasing the parked page', async () => {
  const service = host.daemon.service;
  service.board.record(
    'card',
    {
      ...service.board.get<Card>('card', card.id),
      packet: {
        resume: '# Example Candidate\n\nBuilt fictional interfaces.',
        coverLetter: 'Dear Clay Fixture Company,\n\nI would like to apply.',
        formAnswers: '',
        note: '',
        claims: [
          {
            claim: 'Built fictional interfaces.',
            source: 'profile.md',
            quote: 'Built fictional interfaces.',
          },
        ],
      },
    },
    'user',
    'Clay packet fixture',
  );
  const switcher = page.getByRole('tablist', { name: 'Side panel view', exact: true });
  await switcher.waitFor({ timeout: 10000 });
  await settled();
  const approval = await request();
  await tray().getByRole('region', { name: 'Pending browser action', exact: true }).waitFor();
  const before = await lastMount();
  const size = { ...viewport };
  const resizes = resize.mock.calls.length;
  await switcher.getByRole('tab', { name: 'Packet' }).click();
  await page.locator('.browser-packet-view').getByText('Built fictional interfaces.').waitFor();
  await vi.waitFor(async () => expect(await lastMount()).toBeNull());
  expect(await body().isVisible()).toBe(false);
  // Hold beyond the sizing debounce: a hidden page must not request a new viewport.
  await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 400)));
  expect(viewport).toEqual(size);
  for (const [requested] of resize.mock.calls.slice(resizes)) expect(requested).toEqual(size);
  expect(approvalStatus(approval.id)).toBe('pending');
  await switcher.getByRole('tab', { name: 'Browser' }).click();
  await vi.waitFor(async () => expect(await lastMount()).toEqual(before));
  expect(viewport).toEqual(size);
  expect(approvalStatus(approval.id)).toBe('pending');
  await tray().getByRole('region', { name: 'Pending browser action', exact: true }).waitFor();
  service.computer.decide(approval.id, false);
  await tray()
    .getByRole('region', { name: 'Pending browser action', exact: true })
    .waitFor({ state: 'hidden' });
}, 20000);

test('expands beside an activity column, mirrors the message draft and steps back on Escape', async () => {
  await host.daemon.service.computer.stop(scope.runId);
  const expand = page.getByRole('button', { name: 'Expand browser', exact: true });
  const side = page.locator('.browser-expanded-side');
  const back = page.getByRole('button', { name: 'Back to chat', exact: true });
  await expand.click();
  await side.waitFor();
  const reply = side.locator('.browser-reply-input');
  expect(await reply.getAttribute('aria-label')).toBe('Message Writer');
  await reply.fill('Mirrored from the expanded browser');
  await vi.waitFor(async () =>
    expect(await page.locator('.chat-rich-input').textContent()).toBe(
      'Mirrored from the expanded browser',
    ),
  );
  await back.focus();
  await page.keyboard.press('Escape');
  await side.waitFor({ state: 'hidden' });
  await expand.waitFor();
  expect(await page.locator('#agent-browser-panel').isVisible()).toBe(true);
  expect(await page.locator('.chat-rich-input').textContent()).toBe(
    'Mirrored from the expanded browser',
  );

  await expand.click();
  await side.waitFor();
  await page.getByRole('button', { name: 'Browser options', exact: true }).click();
  const menu = page.getByRole('menu');
  await menu.waitFor();
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  expect(await side.isVisible()).toBe(true);
  expect(await back.isVisible()).toBe(true);
  await page.keyboard.press('Escape');
  await side.waitFor({ state: 'hidden' });
  await expand.waitFor();

  await expand.click();
  await side.waitFor();
  await side.locator('.browser-reply-input').fill('');
  // Expanded view offers only Back to chat; hiding the panel happens from the split view.
  expect(await page.getByRole('button', { name: 'Hide browser', exact: true }).count()).toBe(0);
  await back.click();
  await side.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Hide browser', exact: true }).click();
  await page.locator('#agent-browser-panel').waitFor({ state: 'hidden' });
  await vi.waitFor(async () => expect(await lastMount()).toBeNull());
  expect(await expand.count()).toBe(0);
});
