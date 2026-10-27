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
        for (const current of context.pages()) {
          const session = await context.newCDPSession(current);
          try {
            const info = await session.send('Target.getTargetInfo');
            if (info.targetInfo.targetId === next.activeTab) {
              driver.selectPage?.(current);
              break;
            }
          } finally {
            await session.detach();
          }
        }
        return next;
      };
      return {
        ...driver,
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
