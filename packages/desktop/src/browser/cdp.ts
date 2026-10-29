import type { WebContents } from 'electron';
import type { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { nativeBrowserPageUrl } from './dom-protocol.ts';

export interface RelayPage {
  id: string;
  openerId?: string;
  ready?: boolean;
  contents: WebContents;
  send(
    method: string,
    params: Record<string, unknown>,
    child?: string,
    owner?: string,
  ): Promise<unknown>;
  releaseAutomation?(owner?: string): void;
}
export interface RelayGroup {
  pages: Map<string, RelayPage>;
  create(): Promise<RelayPage>;
  close(id: string): void | Promise<void>;
}

/** A synthetic browser exposes only this job's guest targets, never the app window. */
export const connectBrowserRelay = (group: RelayGroup, socket: WebSocket) => {
  const pageSessions = new Map<string, string>();
  const childSessions = new Map<string, { pageId: string; parent: string }>();
  const browserSessions = new Set<string>();
  const subscriptions = new Map<string, () => void>();
  const owners = new Map<string, RelayPage>();
  const crashed = new Set<string>();
  const connectionId = randomUUID();
  let disposed = false;
  let autoAttach = false;
  let serial = 0;
  const send = (value: unknown) => {
    if (!disposed && socket.readyState === 1) socket.send(JSON.stringify(value));
  };
  const ownerId = (sessionId: string) => `${connectionId}:${sessionId}`;
  const releaseSession = (sessionId: string) => {
    const owner = ownerId(sessionId);
    owners.get(owner)?.releaseAutomation?.(owner);
    owners.delete(owner);
  };
  const pageCommand = (
    page: RelayPage,
    method: string,
    params: Record<string, unknown>,
    sessionId: string,
    child?: string,
  ) => {
    if (disposed) return Promise.reject(new Error('Browser connection closed.'));
    const owner = ownerId(sessionId);
    owners.set(owner, page);
    return page.send(method, params, child, owner);
  };
  const info = (page: RelayPage) => ({
    targetId: page.id,
    type: 'page',
    title: page.contents.getTitle(),
    url: nativeBrowserPageUrl(page.contents.getURL()),
    attached: true,
    canAccessOpener: !!page.openerId,
    ...(page.openerId ? { openerId: page.openerId } : {}),
    browserContextId: 'pitchcrew-guest',
  });
  const detachPageSessions = (id: string) => {
    for (const [owner, page] of owners)
      if (page.id === id) {
        page.releaseAutomation?.(owner);
        owners.delete(owner);
      }
    for (const [child, parent] of childSessions)
      if (parent.pageId === id) childSessions.delete(child);
    for (const [sessionId, target] of pageSessions)
      if (target === id) {
        send({ method: 'Target.detachedFromTarget', params: { sessionId, targetId: id } });
        pageSessions.delete(sessionId);
      }
  };
  const subscribe = (page: RelayPage) => {
    if (subscriptions.has(page.id)) return;
    const event = (
      _event: Electron.Event,
      method: string,
      params: Record<string, unknown>,
      child?: string,
    ) => {
      const sessionId = [...pageSessions].find(([, target]) => target === page.id)?.[0];
      if (!sessionId) return;
      if (method === 'Target.attachedToTarget' && typeof params.sessionId === 'string') {
        if ((params.targetInfo as { type?: string } | undefined)?.type === 'page') {
          // Popups get their own root guest session; release the parent's temporary auto-attach.
          void pageCommand(page, 'Runtime.runIfWaitingForDebugger', {}, sessionId, params.sessionId)
            .then(() =>
              pageCommand(
                page,
                'Target.detachFromTarget',
                { sessionId: params.sessionId },
                sessionId,
              ),
            )
            .catch(() => {});
          return;
        }
        childSessions.set(params.sessionId, { pageId: page.id, parent: sessionId });
      }
      if (method === 'Target.detachedFromTarget' && typeof params.sessionId === 'string') {
        releaseSession(params.sessionId);
        childSessions.delete(params.sessionId);
      }
      if (child) send({ method, params, sessionId: child });
      else
        for (const [root, target] of pageSessions)
          if (target === page.id) send({ method, params, sessionId: root });
    };
    const debuggerApi = page.contents.debugger;
    const crash = () => {
      crashed.add(page.id);
      detachPageSessions(page.id);
      subscriptions.get(page.id)?.();
      subscriptions.delete(page.id);
    };
    debuggerApi.on('message', event);
    page.contents.on('render-process-gone', crash);
    subscriptions.set(page.id, () => {
      debuggerApi.removeListener('message', event);
      page.contents.removeListener('render-process-gone', crash);
    });
  };
  const announce = (page: RelayPage) => {
    if (
      page.ready === false ||
      crashed.has(page.id) ||
      !autoAttach ||
      [...pageSessions.values()].includes(page.id)
    )
      return;
    const sessionId = `page-${++serial}`;
    pageSessions.set(sessionId, page.id);
    subscribe(page);
    send({
      method: 'Target.attachedToTarget',
      params: { sessionId, targetInfo: info(page), waitingForDebugger: false },
    });
  };
  const command = async (method: string, params: Record<string, unknown>, sessionId?: string) => {
    if (sessionId && !browserSessions.has(sessionId)) {
      const target = pageSessions.get(sessionId);
      if (!target) throw new Error('Unknown browser page session.');
      const page = group.pages.get(target);
      if (!page) throw new Error('Browser tab is closed.');
      if (method === 'Target.getTargetInfo') return { targetInfo: info(page) };
      if (method === 'Emulation.setFocusEmulationEnabled') return {};
      return pageCommand(page, method, params, sessionId);
    }
    switch (method) {
      case 'Browser.getVersion':
        return {
          protocolVersion: '1.3',
          product: `Chrome/${process.versions.chrome ?? '156.0.0.0'}`,
          revision: '',
          userAgent: [...group.pages.values()][0]?.contents.getUserAgent() ?? '',
          jsVersion: '',
        };
      case 'Target.getBrowserContexts':
        return { browserContextIds: [] };
      case 'Target.getTargets':
        return {
          targetInfos: [...group.pages.values()].filter((page) => page.ready !== false).map(info),
        };
      case 'Target.getTargetInfo':
        return {
          targetInfo: {
            targetId: 'pitchcrew-browser',
            type: 'browser',
            title: '',
            url: '',
            attached: true,
          },
        };
      case 'Target.setAutoAttach':
        autoAttach = true;
        queueMicrotask(() => {
          for (const page of group.pages.values()) announce(page);
        });
        return {};
      case 'Target.attachToBrowserTarget': {
        const id = `browser-${++serial}`;
        browserSessions.add(id);
        return { sessionId: id };
      }
      case 'Target.attachToTarget': {
        const id = String(params.targetId);
        if (!group.pages.has(id) || group.pages.get(id)?.ready === false)
          throw new Error('Cannot attach another browser target.');
        if (crashed.has(id)) throw new Error('The browser page is recovering from a crash.');
        const pageSession = `page-${++serial}`;
        pageSessions.set(pageSession, id);
        subscribe(group.pages.get(id)!);
        return { sessionId: pageSession };
      }
      case 'Target.detachFromTarget': {
        const detached = String(params.sessionId);
        releaseSession(detached);
        for (const [child, owner] of childSessions)
          if (owner.parent === detached) {
            releaseSession(child);
            childSessions.delete(child);
          }
        const target = pageSessions.get(detached);
        pageSessions.delete(detached);
        browserSessions.delete(detached);
        if (target && ![...pageSessions.values()].includes(target)) {
          subscriptions.get(target)?.();
          subscriptions.delete(target);
        }
        return {};
      }
      case 'Target.createTarget': {
        if (params.url !== 'about:blank') throw new Error('New browser tabs start blank.');
        const page = await group.create();
        announce(page);
        return { targetId: page.id };
      }
      case 'Target.closeTarget':
        await group.close(String(params.targetId));
        return { success: true };
      case 'Target.setDiscoverTargets':
      case 'Browser.setDownloadBehavior':
      case 'Browser.grantPermissions':
      case 'Browser.resetPermissions':
        return {};
      case 'Browser.close':
        setImmediate(() => socket.close());
        return {};
      default:
        throw new Error(`Unsupported browser operation: ${method}`);
    }
  };
  socket.on('message', (data) => {
    if (disposed) return;
    const bytes = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
    if (bytes.byteLength > 4_000_000) {
      socket.close(1009);
      return;
    }
    let value: { id: number; method: string; params?: Record<string, unknown>; sessionId?: string };
    try {
      value = JSON.parse(bytes.toString());
    } catch {
      return;
    }
    if (!Number.isInteger(value.id) || typeof value.method !== 'string') return;
    if (value.sessionId && childSessions.has(value.sessionId)) {
      // Only child targets announced by this group's debugger may be addressed.
      const parent = childSessions.get(value.sessionId);
      const page = parent && group.pages.get(parent.pageId);
      if (page) {
        void pageCommand(
          page,
          value.method,
          value.params ?? {},
          value.sessionId,
          value.sessionId,
        ).then(
          (result) => send({ id: value.id, sessionId: value.sessionId, result }),
          () =>
            send({
              id: value.id,
              sessionId: value.sessionId,
              error: { code: -32000, message: 'Child frame operation failed.' },
            }),
        );
        return;
      }
    }
    void command(value.method, value.params ?? {}, value.sessionId).then(
      (result) => send({ id: value.id, sessionId: value.sessionId, result }),
      (error: unknown) =>
        send({
          id: value.id,
          sessionId: value.sessionId,
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : 'Browser operation failed.',
          },
        }),
    );
  });
  const closed = (id: string) => {
    detachPageSessions(id);
    crashed.delete(id);
    subscriptions.get(id)?.();
    subscriptions.delete(id);
  };
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    for (const [owner, page] of owners) page.releaseAutomation?.(owner);
    owners.clear();
    for (const stop of subscriptions.values()) stop();
    subscriptions.clear();
    pageSessions.clear();
    childSessions.clear();
    browserSessions.clear();
    crashed.clear();
  };
  socket.once('close', cleanup);
  return {
    announce,
    closed,
    disconnect: () => {
      cleanup();
      socket.close();
    },
  };
};
