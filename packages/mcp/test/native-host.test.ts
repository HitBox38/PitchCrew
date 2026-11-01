import { chromium, type Browser, type Page } from 'playwright';
import { afterEach, expect, it, vi } from 'vitest';
import { DesktopBrowserHosts } from '../src/computer/native-host.ts';
import { createAttachedBrowserDriver } from '../src/computer/driver.ts';

vi.mock('playwright', () => ({ chromium: { connectOverCDP: vi.fn() } }));
vi.mock('../src/computer/driver.ts', () => ({ createAttachedBrowserDriver: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

const fixture = async (
  phase: 'before' | 'attach' | 'inspect' | 'detach' | 'live' | 'live-detach',
) => {
  const error = new Error(
    'browserContext.newCDPSession: Protocol error (Target.attachToTarget): Cannot attach another browser target.',
  );
  let closed = false;
  const stale = { isClosed: () => closed } as Page;
  const active = { isClosed: () => false } as Page;
  const staleSession = {
    send: vi.fn(async () => {
      if (phase === 'inspect') {
        closed = true;
        throw error;
      }
      return { targetInfo: { targetId: 'closed-tab' } };
    }),
    detach: vi.fn(async () => {
      if (phase === 'detach' || phase === 'live-detach') {
        closed = phase === 'detach';
        throw error;
      }
    }),
  };
  const activeSession = {
    send: vi.fn(async () => ({ targetInfo: { targetId: 'active-tab' } })),
    detach: vi.fn(async () => {}),
  };
  const context = {
    pages: () => [stale, active],
    newCDPSession: vi.fn(async (page: Page) => {
      if (page === active) return activeSession;
      if (phase === 'attach' || phase === 'live') {
        closed = phase !== 'live';
        throw error;
      }
      return staleSession;
    }),
  };
  vi.mocked(chromium.connectOverCDP).mockResolvedValue({
    contexts: () => [context],
  } as unknown as Browser);
  const selectPage = vi.fn();
  vi.mocked(createAttachedBrowserDriver).mockResolvedValue({
    selectPage,
    snapshot: vi.fn(),
    perform: vi.fn(),
    close: vi.fn(),
  });
  const host = {
    ownerId: '82c426cd-12d2-480e-acd3-dab28bd2fe71',
    origin: 'http://127.0.0.1:59001',
    token: 'a'.repeat(64),
  };
  const id = 'fdebb1e8-41d2-4e34-89c8-e50259ae47ab';
  const state = {
    id,
    ownerId: host.ownerId,
    activeTab: 'active-tab',
    tabs: [{ id: 'active-tab' }],
    endpoint: `ws://127.0.0.1:59001/sessions/${id}/cdp`,
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(state));
  const hosts = new DesktopBrowserHosts();
  hosts.register(host);
  const driver = await hosts.launch();
  if (phase === 'before') closed = true;
  return { driver, context, stale, active, selectPage, activeSession, error, state };
};

it.each(['before', 'attach', 'inspect', 'detach'] as const)(
  'selects the remaining native page when a tab closes during %s',
  async (phase) => {
    const { driver, context, stale, active, selectPage, activeSession, state } =
      await fixture(phase);
    await expect(
      driver.nativeCommand!({ kind: 'close-tab', tabId: 'closed-tab' }),
    ).resolves.toEqual(state);
    expect(selectPage).toHaveBeenCalledExactlyOnceWith(active);
    expect(activeSession.detach).toHaveBeenCalledOnce();
    if (phase === 'before') expect(context.newCDPSession).not.toHaveBeenCalledWith(stale);
  },
);

it('preserves attachment failures for pages that are still open', async () => {
  const { driver, error, selectPage } = await fixture('live');
  await expect(driver.nativeCommand!({ kind: 'close-tab', tabId: 'closed-tab' })).rejects.toBe(
    error,
  );
  expect(selectPage).not.toHaveBeenCalled();
});

it('preserves detach failures for pages that are still open', async () => {
  const { driver, error, selectPage } = await fixture('live-detach');
  await expect(driver.nativeCommand!({ kind: 'close-tab', tabId: 'closed-tab' })).rejects.toBe(
    error,
  );
  expect(selectPage).not.toHaveBeenCalled();
});
