import type { WebContents } from 'electron';
import type { WebSocket } from 'ws';

export interface RelayPage {
  id: string;
  openerId?: string;
  contents: WebContents;
  send(method: string, params: Record<string, unknown>, child?: string): Promise<unknown>;
}
export interface RelayGroup {
  pages: Map<string, RelayPage>;
  create(): Promise<RelayPage>;
  close(id: string): Promise<void>;
}

/** A synthetic browser exposes only this job's guest targets, never the app window. */
export const connectBrowserRelay = (group: RelayGroup, socket: WebSocket) => {
  const pageSessions = new Map<string, string>();
  const childSessions = new Map<string, string>();
  const browserSessions = new Set<string>();
  const subscriptions = new Map<string, () => void>();
  let autoAttach = false;
  let serial = 0;
  const send = (value: unknown) => {
    if (socket.readyState === 1) socket.send(JSON.stringify(value));
  };
  const info = (page: RelayPage) => ({
    targetId: page.id,
    type: 'page',
    title: page.contents.getTitle(),
    url: page.contents.getURL(),
    attached: true,
    canAccessOpener: !!page.openerId,
    ...(page.openerId ? { openerId: page.openerId } : {}),
    browserContextId: 'pitchcrew-guest',
  });
  const announce = (page: RelayPage) => {
    if (!autoAttach || subscriptions.has(page.id)) return;
    const sessionId = `page-${++serial}`;
    pageSessions.set(sessionId, page.id);
    const event = (
      _event: Electron.Event,
      method: string,
      params: Record<string, unknown>,
      child?: string,
    ) => {
      if (method === 'Target.attachedToTarget' && typeof params.sessionId === 'string') {
        if ((params.targetInfo as { type?: string } | undefined)?.type === 'page') {
          // Popups get their own root guest session; release the parent's temporary auto-attach.
          void page
            .send('Runtime.runIfWaitingForDebugger', {}, params.sessionId)
            .then(() => page.send('Target.detachFromTarget', { sessionId: params.sessionId }))
            .catch(() => {});
          return;
        }
        childSessions.set(params.sessionId, page.id);
      }
      if (method === 'Target.detachedFromTarget' && typeof params.sessionId === 'string')
        childSessions.delete(params.sessionId);
      send({ method, params, sessionId: child || sessionId });
    };
    const debuggerApi = page.contents.debugger;
    debuggerApi.on('message', event);
    subscriptions.set(page.id, () => debuggerApi.removeListener('message', event));
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
      return page.send(method, params);
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
        return { targetInfos: [...group.pages.values()].map(info) };
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
        if (!group.pages.has(id)) throw new Error('Cannot attach another browser target.');
        const pageSession = `page-${++serial}`;
        pageSessions.set(pageSession, id);
        return { sessionId: pageSession };
      }
      case 'Target.detachFromTarget':
        pageSessions.delete(String(params.sessionId));
        return {};
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
      const page = parent && group.pages.get(parent);
      if (page) {
        void page.send(value.method, value.params ?? {}, value.sessionId).then(
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
    for (const [child, parent] of childSessions) if (parent === id) childSessions.delete(child);
    subscriptions.get(id)?.();
    subscriptions.delete(id);
    for (const [sessionId, target] of pageSessions)
      if (target === id) {
        send({ method: 'Target.detachedFromTarget', params: { sessionId, targetId: id } });
        pageSessions.delete(sessionId);
      }
  };
  socket.once('close', () => {
    for (const stop of subscriptions.values()) stop();
    subscriptions.clear();
  });
  return { announce, closed, disconnect: () => socket.close() };
};
