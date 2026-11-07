import { randomUUID } from 'node:crypto';
import type { RuntimeAuthMethod, RuntimeAuthResponse } from '@pitchcrew/core';
import { signInChild } from './process.ts';
import type { NativeSignInOptions, NativeSignInProcess } from './types.ts';

export interface AcpAuthOptions extends NativeSignInOptions {
  args: string[];
  directory: string;
  validateUrl: (url: unknown) => string;
}
interface AdvertisedMethod {
  id: string;
  name: string;
  description?: string;
}

/** Authentication RPCs only. Never starts a prompt or grants host/tool capabilities. */
const connection = (options: AcpAuthOptions) => {
  const child = signInChild(options.args, options, true);
  const pending = new Map<number, { resolve: (result: unknown) => void; reject: () => void }>();
  let nextId = 0,
    buffer = '';
  let consent: { interactionId: string; rpcId: unknown } | undefined;
  const send = (value: unknown) =>
    child.write(JSON.stringify({ jsonrpc: '2.0', ...(value as object) }) + '\n');
  const request = (method: string, params: unknown): Promise<unknown> => {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, {
        resolve,
        reject: () => reject(new Error('The ACP authentication request failed.')),
      });
      send({ id, method, params });
    });
  };
  const receive = (event: Record<string, unknown>) => {
    if (typeof event.method === 'string') {
      if (event.id === undefined) return;
      const params = event.params as Record<string, unknown> | undefined;
      if (
        ['session/elicitation', '_session/elicitation', 'elicitation/create'].includes(
          event.method,
        ) &&
        params?.mode === 'url' &&
        typeof params.elicitationId === 'string' &&
        params.elicitationId.length <= 100
      ) {
        if (consent) {
          send({ id: event.id, result: { action: 'decline' } });
          return;
        }
        const interactionId = randomUUID();
        const url = options.validateUrl(params.url);
        consent = { interactionId, rpcId: event.id };
        options.onAction({
          interaction: { id: interactionId, type: 'browser', url, requiresConsent: true },
        });
      } else if (event.method === 'session/request_permission')
        send({ id: event.id, result: { outcome: { outcome: 'cancelled' } } });
      else
        send({
          id: event.id,
          error: { code: -32601, message: 'Pitchcrew does not provide this client capability.' },
        });
      return;
    }
    if (typeof event.id !== 'number') return;
    const entry = pending.get(event.id);
    if (!entry) return;
    pending.delete(event.id);
    if (event.error) entry.reject();
    else entry.resolve(event.result);
  };
  child.receive(child.stdout, (text) => {
    buffer += text;
    let end: number;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (event && typeof event === 'object') receive(event);
    }
  });
  child.receive(child.stderr, () => {});
  const finished = child.completion.finally(() => {
    for (const entry of pending.values()) entry.reject();
    pending.clear();
  });
  // A command exit rejects pending RPCs; callers await their operation and this completion.
  void finished.catch(() => {});
  return {
    child,
    finished,
    request,
    initialize: () =>
      request('initialize', {
        protocolVersion: 1,
        clientInfo: { name: 'pitchcrew-auth', version: '0.18.0' },
        clientCapabilities: {
          fs: { readTextFile: false, writeTextFile: false },
          terminal: false,
          auth: { terminal: false },
          elicitation: { url: {} },
        },
      }),
    respond: (response: RuntimeAuthResponse) => {
      if (response.type !== 'browser' || !consent)
        throw new Error('This ACP sign-in is not waiting for browser consent.');
      send({
        id: consent.rpcId,
        result: { action: response.action === 'open' ? 'accept' : 'decline' },
      });
      consent = undefined;
    },
  };
};

const methodsFromInitialize = (value: unknown): AdvertisedMethod[] => {
  const result = value as { protocolVersion?: unknown; authMethods?: unknown } | undefined;
  if (
    result?.protocolVersion !== 1 ||
    !Array.isArray(result.authMethods) ||
    result.authMethods.length > 32
  )
    return [];
  return result.authMethods.flatMap((value) => {
    const method = value as { id?: unknown; name?: unknown; type?: unknown; description?: unknown };
    if (
      !method ||
      typeof method !== 'object' ||
      (method.type !== undefined && method.type !== 'agent') ||
      typeof method.id !== 'string' ||
      !/^[\w.:-]{1,90}$/.test(method.id) ||
      typeof method.name !== 'string' ||
      !method.name.trim() ||
      method.name.length > 100
    )
      return [];
    return [
      {
        id: method.id,
        name: method.name.trim(),
        ...(typeof method.description === 'string'
          ? { description: method.description.slice(0, 300) }
          : {}),
      },
    ];
  });
};

export const discoverAcpAuthMethods = async (
  options: AcpAuthOptions,
): Promise<RuntimeAuthMethod[]> => {
  const client = connection(options);
  try {
    const methods = methodsFromInitialize(await client.initialize());
    return methods.map((method) => ({
      id: `acp:${method.id}`,
      label: method.name,
      kind: 'browser',
      description: method.description,
    }));
  } finally {
    client.child.succeed();
    await client.finished.catch(() => {});
  }
};

export const acpSignIn = (options: AcpAuthOptions): NativeSignInProcess => {
  const client = connection(options);
  const completion = (async () => {
    try {
      const methods = methodsFromInitialize(await client.initialize());
      const methodId = options.methodId?.replace(/^acp:/, '');
      if (!methodId || !methods.some((method) => method.id === methodId))
        throw new Error('The ACP agent no longer advertises this sign-in method.');
      await client.request('authenticate', { methodId });
      // No prompt and no MCP servers. A session handshake only checks the advertised auth contract.
      const session = (await client.request('session/new', {
        cwd: options.directory,
        mcpServers: [],
      })) as { sessionId?: unknown } | undefined;
      if (typeof session?.sessionId !== 'string' || !session.sessionId)
        throw new Error('The ACP agent did not verify authentication.');
      client.child.succeed();
      await client.finished;
    } catch {
      client.child.fail('The ACP agent could not complete sign-in. Recheck its authentication.');
      await client.finished.catch(() => {});
      throw new Error('The ACP agent could not complete sign-in. Recheck its authentication.');
    }
  })();
  return {
    completion,
    respond: () => {
      throw new Error('Use the current ACP authentication interaction.');
    },
    respondInteraction: client.respond,
  };
};
