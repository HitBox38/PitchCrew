import { createServer, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import type { RemoteMcpInfo } from '@pitchcrew/core';
import { RemoteAuthorization, createRemoteHttpHandler } from '@pitchcrew/mcp/remote';
import type { ExternalAction } from '@pitchcrew/mcp/external/tools';
import { findTunnelExecutable, openRemoteTunnel } from './tunnel.ts';

export class RemoteMcpAccess {
  private state: RemoteMcpInfo['state'] = 'off';
  private error = '';
  private url: string | null = null;
  private controller?: AbortController;
  private worker?: Promise<void>;
  private server?: Server;
  private tunnel?: Awaited<ReturnType<typeof openRemoteTunnel>>;
  private authorization?: RemoteAuthorization;
  private mutation: Promise<unknown> = Promise.resolve();
  private cleanup: Promise<void> = Promise.resolve();

  constructor(
    private readonly directory: string,
    private readonly call: (
      action: ExternalAction,
      input: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>,
  ) {}

  info = async (): Promise<RemoteMcpInfo> => {
    const tunnelAvailable = !!(await findTunnelExecutable());
    return {
      state: this.state,
      url: this.url,
      error: this.error,
      tunnelAvailable,
      requests: this.authorization?.requests() ?? [],
      clients: this.authorization?.clients() ?? [],
    };
  };

  private exclusive = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = this.mutation.then(operation);
    this.mutation = result.catch(() => {});
    return result;
  };

  start = () =>
    this.exclusive(async () => {
      await this.cleanup;
      if (this.state === 'starting' || this.state === 'ready') return this.info();
      this.state = 'starting';
      this.error = '';
      this.url = null;
      const controller = new AbortController();
      this.controller = controller;
      this.worker = this.open(controller).catch(async (error) => {
        if (controller.signal.aborted) return;
        this.error =
          error instanceof Error ? error.message : 'Could not start the remote connection.';
        this.url = null;
        controller.abort();
        await this.release().catch(() => {});
        if (this.controller === controller && this.state !== 'off') this.state = 'failed';
      });
      return this.info();
    });

  private open = async (controller: AbortController) => {
    const executable = await findTunnelExecutable();
    controller.signal.throwIfAborted();
    if (!executable) throw new Error('Install cloudflared to start a temporary remote connection.');
    let handler: ReturnType<typeof createRemoteHttpHandler> | undefined;
    const server = createServer({ maxHeaderSize: 16384 }, (req, res) => {
      if (controller.signal.aborted || !handler) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end('{"error":"not_ready"}');
      } else handler(req, res);
    });
    server.requestTimeout = 30000;
    server.headersTimeout = 15000;
    server.maxHeadersCount = 64;
    server.maxConnections = 32;
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    controller.signal.throwIfAborted();
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Could not open the MCP connection.');
    const local = new URL(`http://127.0.0.1:${address.port}`);
    const tunnel = await openRemoteTunnel(local, controller.signal, executable);
    this.tunnel = tunnel;
    controller.signal.throwIfAborted();
    const resource = new URL('/mcp', tunnel.origin);
    const authorization = await RemoteAuthorization.open(this.directory, resource);
    // Every temporary address starts with fresh consent, including after daemon restarts.
    await authorization.revokeAll();
    controller.signal.throwIfAborted();
    this.authorization = authorization;
    const instance = randomBytes(24).toString('hex');
    handler = createRemoteHttpHandler({
      resource,
      localHost: local.host,
      authorization,
      instance,
      call: this.call,
    });
    const verify = async () => {
      for (let attempt = 0; attempt < 15; attempt++) {
        controller.signal.throwIfAborted();
        try {
          const response = await fetch(new URL('/connection-check', tunnel.origin), {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
            redirect: 'error',
          });
          const reader = response.body?.getReader();
          let body = '';
          if (reader)
            try {
              for (;;) {
                const part = await reader.read();
                if (part.done) break;
                body += new TextDecoder().decode(part.value);
                if (body.length > 512) break;
              }
            } finally {
              await reader.cancel();
            }
          if (response.ok && body === JSON.stringify({ instance })) return;
        } catch {
          /* The address can be printed before DNS and the tunnel are ready. */
        }
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            reject(controller.signal.reason);
          };
          const timer = setTimeout(() => {
            controller.signal.removeEventListener('abort', abort);
            resolve();
          }, 1000);
          controller.signal.addEventListener('abort', abort, { once: true });
        });
      }
      throw new Error(
        'The temporary address could not be reached. Check your network, then start again.',
      );
    };
    await Promise.race([
      verify(),
      tunnel.closed.then(() => {
        throw new Error('The temporary connection closed before it was ready.');
      }),
    ]);
    controller.signal.throwIfAborted();
    this.url = resource.href;
    this.state = 'ready';
    const disconnected = () => {
      if (controller.signal.aborted) return;
      this.error = 'The temporary connection stopped. Start again and reconnect your apps.';
      this.url = null;
      controller.abort();
      this.cleanup = this.release()
        .catch(() => {})
        .then(() => {
          if (this.controller === controller && this.state !== 'off') this.state = 'failed';
        });
      return this.cleanup;
    };
    void tunnel.closed.then(disconnected, disconnected);
  };

  decide = async (id: string, decision: { approved: boolean; write: boolean }) => {
    if (this.state !== 'ready' || !this.authorization)
      throw new Error('Start a remote connection first.');
    await this.authorization.decide(id, decision);
    return this.info();
  };

  revoke = async (id: string) => {
    if (!this.authorization) throw new Error('This connection is no longer active.');
    await this.authorization.revoke(id);
    return this.info();
  };

  private release = async () => {
    const { authorization, tunnel, server } = this;
    this.authorization = undefined;
    this.tunnel = undefined;
    this.server = undefined;
    const closing = server
      ? new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        })
      : Promise.resolve();
    const [revocation] = await Promise.allSettled([
      authorization?.revokeAll(),
      tunnel?.close(),
      closing,
    ]);
    if (revocation.status === 'rejected') throw revocation.reason;
  };

  stop = () => {
    this.controller?.abort();
    return this.exclusive(async () => {
      this.controller?.abort();
      this.url = null;
      this.state = 'off';
      this.error = '';
      await this.release();
      await this.worker;
      await this.cleanup;
      // Starting can have created a resource immediately before observing cancellation.
      await this.release();
      return this.info();
    });
  };
}
