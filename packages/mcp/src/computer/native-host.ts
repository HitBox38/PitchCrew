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
    if (!host || host.expires < Date.now()) return launchBrowser(profile);
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
      const select = async (next: NativeBrowserState) => {
        for (let attempt = 0; attempt < 100; attempt++) {
          for (const current of context.pages()) {
            if (current.isClosed()) continue;
            try {
              const session = await context.newCDPSession(current);
              try {
                const info = await session.send('Target.getTargetInfo');
                if (info.targetInfo.targetId === next.activeTab) {
                  driver.selectPage?.(current);
                  return next;
                }
              } finally {
                await session.detach();
              }
            } catch (error) {
              // Tab state arrives over HTTP while close events arrive over CDP.
              // A page from this iteration can disappear before its session attaches.
              if (!current.isClosed()) throw error;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error('The native browser tab did not connect. Inspect again.');
      };
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
        targetTab,
        resolveAction: async (action) => {
          if (action.tabId) await targetTab(action.tabId);
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
          await request(`/sessions/${state.id}`, 'DELETE').catch(() => {});
          await driver.close().catch(() => {});
        },
        native: { id: state.id, ownerId: host.ownerId },
        newTab: () => this.launch(profile),
        nativeState: async () => ({
          ...(await request<NativeBrowserState>(`/sessions/${state.id}`)),
          ...driver.viewMetadata?.(),
        }),
        nativeCommand: async (command: NativeBrowserCommand) => {
          if (driver.viewMetadata?.().dialog)
            throw new Error('Resolve the website dialog before changing tabs or navigating.');
          return select(
            await request<NativeBrowserState>(`/sessions/${state.id}/command`, 'POST', command),
          );
        },
        setManual: async (manual) => {
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
