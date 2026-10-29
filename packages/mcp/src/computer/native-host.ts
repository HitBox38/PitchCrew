import { createHash } from 'node:crypto';
import type {
  DesktopBrowserHost,
  NativeBrowserState,
  NativeBrowserCommand,
} from '../../../core/src/native-browser.ts';
import type { BrowserDriver } from './types.ts';
import { createAttachedBrowserDriver, launchBrowser } from './driver.ts';

export class DesktopBrowserHosts {
  private host?: DesktopBrowserHost & { expires: number };
  register = (host: DesktopBrowserHost) => {
    this.host = { ...host, expires: Date.now() + 15000 };
  };
  launch = async (profile?: string): Promise<BrowserDriver> => {
    const host = this.host;
    if (!host) return launchBrowser(profile);
    if (host.expires < Date.now())
      throw new Error('The desktop browser disconnected. Reopen it in the desktop app.');
    const profileId = createHash('sha256')
      .update(profile ?? 'default')
      .digest('hex');
    const request = async <T>(path: string, method = 'GET', body?: unknown) => {
      const response = await fetch(`${host.origin}${path}`, {
        method,
        redirect: 'error',
        headers: { authorization: `Bearer ${host.token}`, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error('The desktop browser is unavailable. Reopen it in the desktop app.');
      return (await response.json()) as T;
    };
    const state = await request<NativeBrowserState & { endpoint: string }>('/sessions', 'POST', {
      profile: profileId,
    });
    const endpoint = new URL(state.endpoint);
    if (
      !/^[a-f0-9-]{36}$/i.test(state.id) ||
      state.ownerId !== host.ownerId ||
      endpoint.protocol !== 'ws:' ||
      endpoint.host !== new URL(host.origin).host ||
      endpoint.pathname !== `/sessions/${state.id}/cdp` ||
      endpoint.search ||
      endpoint.username ||
      endpoint.password
    )
      throw new Error('The desktop browser returned an invalid automation endpoint.');
    const { chromium } = await import('playwright');
    let browser;
    try {
      browser = await chromium.connectOverCDP(state.endpoint, {
        headers: { authorization: `Bearer ${host.token}` },
        timeout: 15000,
      });
      const connected = browser;
      let closing = false;
      const context = browser.contexts()[0];
      const page = context.pages()[0];
      if (!page) throw new Error('The native browser has no page.');
      const policy = async (automatic: boolean) => {
        const result = await request<{ blocked: boolean }>(
          `/sessions/${state.id}/control`,
          'POST',
          { automatic },
        );
        return result.blocked;
      };
      const driver = await createAttachedBrowserDriver(
        context,
        page,
        async () => {
          try {
            await browser!.close();
          } finally {
            await request(`/sessions/${state.id}`, 'DELETE').catch(() => {});
          }
        },
        policy,
      );
      const targetIds = new WeakMap<import('playwright').Page, string>();
      const select = async (next: NativeBrowserState) => {
        if (next.tabs.find((tab) => tab.id === next.activeTab)?.crashed)
          throw new Error(
            'This browser tab crashed. Use Retry page in the desktop app to recover it.',
          );
        for (let attempt = 0; attempt < 100; attempt++) {
          for (const current of context.pages()) {
            if (current.isClosed()) continue;
            let targetId = targetIds.get(current);
            if (!targetId) {
              try {
                const session = await context.newCDPSession(current);
                try {
                  targetId = (await session.send('Target.getTargetInfo')).targetInfo.targetId;
                  targetIds.set(current, targetId);
                } finally {
                  await session.detach();
                }
              } catch (error) {
                if (
                  current.isClosed() ||
                  /(?:Target crashed|Target closed|Session closed)/i.test(String(error))
                )
                  continue;
                throw error;
              }
            }
            if (targetId === next.activeTab) {
              try {
                driver.selectPage?.(current);
                return next;
              } catch (error) {
                if (
                  !(error instanceof Error) ||
                  error.message !== 'This tab is outside the browser session.'
                )
                  throw error;
                // Its CDP Page can be announced just before the driver's async
                // opener/ownership attachment finishes. Retry only this local race.
              }
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error('The native browser tab did not connect. Inspect again.');
      };
      const syncSelected = async () =>
        select(await request<NativeBrowserState>(`/sessions/${state.id}`));
      const targetTab = async (id: string) => {
        const current = await request<NativeBrowserState>(`/sessions/${state.id}`);
        if (!current.tabs.some((tab) => tab.id === id))
          throw new Error('This tab is outside the browser session or closed.');
        if (current.activeTab === id) {
          await select(current);
          return;
        }
        if (current.activeTab !== id)
          await select(
            await request<NativeBrowserState>(`/sessions/${state.id}/agent-tabs`, 'POST', {
              kind: 'select-tab',
              tabId: id,
            }),
          );
      };
      return {
        ...driver,
        snapshot: async (options) => {
          await syncSelected();
          return driver.snapshot(options);
        },
        frame: async () => {
          await syncSelected();
          return driver.frame!();
        },
        matches: async (condition) => {
          await syncSelected();
          return driver.matches!(condition);
        },
        targetTab,
        resolveAction: async (action) => {
          if (action.tabId) await targetTab(action.tabId);
          else await syncSelected();
          const { tabId: _tabId, ...input } = action;
          const resolved = (await driver.resolveAction?.(input)) ?? input;
          return {
            ...resolved,
            tabId: (await request<NativeBrowserState>(`/sessions/${state.id}`)).activeTab,
          };
        },
        tabs: async (command) => {
          if (driver.viewMetadata?.().dialog && command.kind !== 'list')
            throw new Error('Resolve the website dialog first.');
          const next =
            command.kind === 'list'
              ? await request<NativeBrowserState>(`/sessions/${state.id}`)
              : await select(
                  await request<NativeBrowserState>(
                    `/sessions/${state.id}/agent-tabs`,
                    'POST',
                    command.kind === 'open'
                      ? { kind: 'new-tab' }
                      : {
                          kind: command.kind === 'select' ? 'select-tab' : 'close-tab',
                          tabId: 'tabId' in command ? command.tabId : '',
                        },
                  ),
                );
          return next.tabs.map((tab) => ({
            id: tab.id,
            url: tab.url,
            title: tab.title,
            active: tab.id === next.activeTab,
          }));
        },
        onClosed: (receive) => {
          const closed = () => {
            if (!closing) receive();
          };
          connected.on('disconnected', closed);
          return () => connected.off('disconnected', closed);
        },
        close: async () => {
          closing = true;
          try {
            await driver.close();
          } finally {
            await request(`/sessions/${state.id}`, 'DELETE').catch(() => {});
          }
        },
        native: { id: state.id, ownerId: host.ownerId },
        newTab: () => this.launch(profile),
        nativeState: async () => {
          const next = await request<NativeBrowserState>(`/sessions/${state.id}`);
          if (!next.tabs.find((tab) => tab.id === next.activeTab)?.error) await select(next);
          return { ...next, ...driver.viewMetadata?.() };
        },
        nativeCommand: async (command: NativeBrowserCommand) => {
          if (driver.viewMetadata?.().dialog)
            throw new Error('Resolve the website dialog before changing tabs or navigating.');
          return select(
            await request<NativeBrowserState>(`/sessions/${state.id}/command`, 'POST', command),
          );
        },
        setManual: async (manual) => {
          if (manual) driver.prepare?.(false);
          const result = await request<{ fingerprints?: string[] }>(
            `/sessions/${state.id}/control`,
            'POST',
            { manual },
          );
          if (!manual && result.fingerprints) driver.rememberManualFields?.(result.fingerprints);
        },
        resetSignIns: async () => {
          closing = true;
          await request(`/profiles/${profileId}`, 'DELETE');
        },
      };
    } catch (error) {
      await browser?.close().catch(() => {});
      await request(`/sessions/${state.id}`, 'DELETE').catch(() => {});
      throw error;
    }
  };
}
