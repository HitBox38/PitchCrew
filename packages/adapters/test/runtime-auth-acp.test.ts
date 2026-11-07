import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { acpSignIn, discoverAcpAuthMethods } from '../src/runtime-auth/acp.ts';
import { nativeSignInUrl } from '../src/runtime-auth/url.ts';
import type { NativeSignInAction } from '../src/runtime-auth/index.ts';

const fixture = fileURLToPath(new URL('./fixtures/runtime-auth-acp.mjs', import.meta.url));
const options = (mode: string, onAction: (action: NativeSignInAction) => void = () => {}) => ({
  command: process.execPath,
  prefix: [fixture, mode],
  args: ['--acp-fixture'],
  signal: new AbortController().signal,
  directory: tmpdir(),
  validateUrl: (url: unknown) => nativeSignInUrl('codex', url),
  onAction,
  timeout: 3000,
});

it('discovers only advertised protocol auth methods without authenticating or opening a session', async () => {
  expect(await discoverAcpAuthMethods(options('discover'))).toEqual([
    { id: 'acp:oauth', label: 'Native OAuth', kind: 'browser', description: undefined },
  ]);
});

it('requires explicit browser consent and verifies a native session without a prompt or host capabilities', async () => {
  const actions: NativeSignInAction[] = [];
  let waiting!: () => void;
  const consent = new Promise<void>((resolve) => {
    waiting = resolve;
  });
  const child = acpSignIn({
    ...options('auth', (action) => {
      actions.push(action);
      waiting();
    }),
    methodId: 'acp:oauth',
  });
  await Promise.race([
    consent,
    child.completion.then(() => {
      throw new Error('No consent was requested.');
    }),
  ]);
  expect(actions).toHaveLength(1);
  expect(actions[0].interaction).toMatchObject({
    type: 'browser',
    requiresConsent: true,
    url: 'https://auth.openai.com/oauth/authorize?state=fixture-state',
  });
  expect(() => child.respondInteraction!({ type: 'terminal', data: 'unexpected' })).toThrow(
    'browser consent',
  );
  child.respondInteraction!({ type: 'browser', action: 'open' });
  await child.completion;
  expect(() => child.respondInteraction!({ type: 'browser', action: 'open' })).toThrow(
    'browser consent',
  );
});

it('does not send a guessed or agent-advertised terminal method to ACP authenticate', async () => {
  await expect(
    acpSignIn({ ...options('auth'), methodId: 'acp:untrusted-terminal' }).completion,
  ).rejects.toThrow('could not complete');
});

it('rejects unsupported authorization URLs without returning them in interaction state', async () => {
  const actions: NativeSignInAction[] = [];
  await expect(
    acpSignIn({ ...options('bad-url', (action) => actions.push(action)), methodId: 'acp:oauth' })
      .completion,
  ).rejects.toThrow('could not complete');
  expect(actions).toEqual([]);
});
