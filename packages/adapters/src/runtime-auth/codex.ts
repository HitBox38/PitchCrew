import type { NativeSignInOptions, NativeSignInProcess } from './types.ts';
import { signInChild } from './process.ts';
import { nativeSignInUrl } from './url.ts';

/** Official account RPCs only; this connection never creates a thread or inference turn.
 * https://learn.chatgpt.com/docs/app-server#authentication-endpoints
 */
export const codexSignIn = (options: NativeSignInOptions): NativeSignInProcess => {
  const process = signInChild(
    [
      'app-server',
      '--listen',
      'stdio://',
      '-c',
      'features.apps=false',
      '-c',
      'features.hooks=false',
      '-c',
      'analytics.enabled=false',
    ],
    options,
    true,
  );
  let buffer = '',
    loginId = '',
    completedId = '',
    verifying = false,
    expectedId = 1;
  const send = (value: unknown) => process.write(JSON.stringify(value) + '\n');
  const verify = () => {
    if (verifying || !loginId || completedId !== loginId) return;
    verifying = true;
    expectedId = 3;
    send({ id: 3, method: 'account/read', params: { refreshToken: false } });
  };
  const receive = (event: Record<string, unknown>) => {
    if (typeof event.method === 'string') {
      if (event.id !== undefined) {
        send({ id: event.id, error: { code: -32601, message: 'Unsupported capability.' } });
        return;
      }
      if (event.method === 'account/login/completed') {
        const params = event.params as { loginId?: unknown; success?: unknown } | undefined;
        if (typeof params?.loginId !== 'string' || (loginId && params.loginId !== loginId)) return;
        if (params.success !== true) {
          process.fail('Codex sign-in did not complete. Start again.');
          return;
        }
        completedId = params.loginId;
        verify();
      }
      return;
    }
    if (event.id !== expectedId) return;
    if (event.error) {
      process.fail('Codex could not complete native sign-in. Retry or use the CLI instructions.');
      return;
    }
    const result = event.result as Record<string, unknown> | undefined;
    if (!result || typeof result !== 'object') throw new Error('Invalid account response.');
    if (event.id === 1) {
      expectedId = 2;
      send({ method: 'initialized', params: {} });
      send({ id: 2, method: 'account/login/start', params: { type: 'chatgpt' } });
    } else if (event.id === 2) {
      expectedId = 0;
      if (
        result.type !== 'chatgpt' ||
        typeof result.loginId !== 'string' ||
        result.loginId.length > 200 ||
        !result.loginId
      )
        throw new Error('Unsupported login response.');
      loginId = result.loginId;
      options.onAction({ url: nativeSignInUrl('codex', result.authUrl) });
      verify();
    } else {
      const account = result.account as { type?: unknown } | null | undefined;
      if (!verifying || account?.type !== 'chatgpt') {
        process.fail('Codex did not verify the new sign-in. Recheck before continuing.');
        return;
      }
      process.succeed();
    }
  };
  process.receive(process.stdout, (chunk) => {
    buffer += chunk;
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
      receive(event);
    }
  });
  process.receive(process.stderr, () => {});
  process.onAbort(() => {
    if (loginId) send({ id: 4, method: 'account/login/cancel', params: { loginId } });
  });
  send({
    id: 1,
    method: 'initialize',
    params: { clientInfo: { name: 'pitchcrew', version: '0.18.0' } },
  });
  return {
    completion: process.completion,
    respond: () => {
      throw new Error('Codex uses its browser callback, not a pasted code.');
    },
  };
};
