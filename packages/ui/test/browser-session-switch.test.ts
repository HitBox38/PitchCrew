import { chromium, type Browser, type Page } from 'playwright';
import { defaultCapabilities, type Role } from '@pitchcrew/core';
import type { NativeBrowserState } from '../../core/src/native-browser.ts';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { setup, cleanup } from './helpers/daemon.ts';

let browser: Browser;
let page: Page;
let host: Awaited<ReturnType<typeof setup>>;
const ownerId = '8f676ac0-43e0-42d8-b28c-144a059134de';
const states: NativeBrowserState[] = [];
const threads: string[] = [];
let relatedThread: string;
const inputs = vi.fn();
const errors: string[] = [];
beforeAll(async () => {
  host = await setup(23951, false, {
    browserLaunch: async () => {
      const index = states.length;
      const state: NativeBrowserState = {
        id: `8533d8c4-4846-4fe3-a1dd-3685cbd2f6f${index}`,
        ownerId,
        activeTab: `tab-${index}`,
        tabs: [
          {
            id: `tab-${index}`,
            title: '',
            url: 'about:blank',
            loading: false,
            canGoBack: false,
            canGoForward: false,
          },
        ],
      };
      states.push(state);
      return {
        native: { id: state.id, ownerId },
        nativeState: async () => structuredClone(state),
        input: async (value) => {
          inputs(index, value);
          if (value.kind === 'navigate') {
            state.tabs[0].url = value.url;
            state.tabs[0].title = `Job ${index}`;
          }
        },
        resize: async () => true,
        setManual: async () => {},
        snapshot: async () => ({
          url: state.tabs[0].url,
          title: state.tabs[0].title,
          text: 'Fixture',
          screenshot: '',
          digest: 'fixture',
        }),
        perform: async () => {},
        close: async () => {},
      };
    },
  });
  const service = host.daemon.service;
  const role = service.board.get<Role>('role', 'writer');
  service.board.record(
    'role',
    { ...role, capabilities: { ...defaultCapabilities, ...role.capabilities, computerUse: true } },
    'user',
    'Enable fixture browser',
  );
  for (let index = 0; index < 2; index++) {
    const card = service.createCard({ company: `Switch company ${index}`, title: 'Engineer' });
    threads.push(
      service.createConversation({
        title: `Switch job ${index}`,
        participants: ['writer'],
        cardId: card.id,
      }).id,
    );
    if (index === 0)
      relatedThread = service.createConversation({
        title: 'Same job discussion',
        participants: ['writer'],
        cardId: card.id,
      }).id;
  }
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(5000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((ownerId) => {
    const mounts: { id: string; bounds: unknown }[] = [];
    Object.assign(window, {
      nativeSwitchMounts: mounts,
      pitchcrewBrowser: {
        identify: async () => ownerId,
        mount: async (id: string, bounds: unknown) => {
          mounts.push({ id, bounds });
        },
        focusPage: async () => {},
        focusControls: async () => {},
        subscribeShortcuts: () => () => {},
      },
    });
  }, ownerId);
  await page.goto(`${host.daemon.url}/chat/${threads[0]}`, { waitUntil: 'domcontentloaded' });
  await page.locator('button[aria-controls="agent-browser-panel"]').waitFor({ timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
}, 60000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
});
const mounts = () =>
  page.evaluate(
    () =>
      (window as unknown as { nativeSwitchMounts: { id: string; bounds: unknown }[] })
        .nativeSwitchMounts,
  );

test('keeps browser presentation and manual control scoped to the selected job across chat switches', async () => {
  const toggle = () => page.locator('button[aria-controls="agent-browser-panel"]');
  const address = () => page.getByRole('textbox', { name: 'Browser address' });
  await toggle().click();
  await page.getByRole('button', { name: 'Open browser', exact: true }).last().click();
  await page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
  await address().fill('example.com/first-job');
  await address().press('Enter');
  await vi.waitFor(async () =>
    expect((await mounts()).at(-1)).toMatchObject({ id: states[0].id, bounds: expect.any(Object) }),
  );
  const firstLease = host.daemon.service.computer.browsers.list()[0].manual;
  expect(firstLease).toBe(true);
  await page.getByRole('link', { name: 'Switch job 1', exact: true }).click();
  await toggle().click();
  // An unopened second session must not inherit the first job's control or native view.
  await page.getByRole('button', { name: 'Open browser', exact: true }).last().waitFor();
  expect(await page.getByRole('button', { name: 'Return to agent', exact: true }).count()).toBe(0);
  await vi.waitFor(async () => expect((await mounts()).at(-1)?.bounds).toBeNull());
  await page.getByRole('button', { name: 'Open browser', exact: true }).last().click();
  await page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
  await address().fill('example.com/second-job');
  await address().press('Enter');
  await vi.waitFor(() =>
    expect(inputs).toHaveBeenCalledWith(1, {
      kind: 'navigate',
      url: 'https://example.com/second-job',
    }),
  );
  await vi.waitFor(async () =>
    expect((await mounts()).at(-1)).toMatchObject({ id: states[1].id, bounds: expect.any(Object) }),
  );
  const start = (await mounts()).length;
  // Exercise several state/session poll cycles without allowing an old guest to remount.
  let reads = 0;
  const reading = () => {
    reads++;
  };
  page.on('response', reading);
  await vi.waitFor(() => expect(reads).toBeGreaterThanOrEqual(12), { timeout: 10000 });
  page.off('response', reading);
  expect(
    (await mounts()).slice(start).filter((item) => item.bounds && item.id === states[0].id),
  ).toEqual([]);
  await page.getByRole('link', { name: 'Switch job 0', exact: true }).click();
  await vi.waitFor(async () =>
    expect(await address().inputValue()).toBe('https://example.com/first-job'),
  );
  await page.locator(`a[href="/chat/${relatedThread}"]`).first().click();
  await toggle().click();
  await page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
  await vi.waitFor(async () =>
    expect(await address().inputValue()).toBe('https://example.com/first-job'),
  );
  await page.getByRole('button', { name: 'Return to agent', exact: true }).click();
  await page.getByRole('button', { name: 'Take control', exact: true }).waitFor();
  expect(host.daemon.service.computer.browsers.list().map((session) => session.manual)).toEqual([
    false,
    true,
  ]);
  expect(errors).toEqual([]);
}, 30000);
