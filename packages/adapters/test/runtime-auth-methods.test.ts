import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, basename, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import {
  nativeRuntimeAuthMethods,
  nativeRuntimeCanLogout,
  startNativeRuntimeSignIn,
  startNativeRuntimeSignOut,
  type NativeSignInAction,
} from '../src/runtime-auth/index.ts';
import { withRuntimeConnection } from '../src/process/runtime-connection.ts';

const fixture = fileURLToPath(new URL('./fixtures/runtime-auth-native.mjs', import.meta.url));
it('declares native auth-only methods and leaves unsupported login commands external', () => {
  expect(nativeRuntimeAuthMethods('cursor-agent')).toMatchObject([
    { id: 'cursor', kind: 'browser' },
  ]);
  expect(nativeRuntimeAuthMethods('opencode')).toMatchObject([{ id: 'native', kind: 'terminal' }]);
  expect(nativeRuntimeAuthMethods('pi')).toEqual([]);
  expect(nativeRuntimeAuthMethods('hermes')).toEqual([]);
  expect(() =>
    startNativeRuntimeSignIn('codex', {
      command: process.execPath,
      signal: new AbortController().signal,
      methodId: 'shell',
      onAction: () => {},
    }),
  ).toThrow('not supported');
});

it('reads Cursor browser links only after a complete URL and rejects unknown authorization hosts', async () => {
  const actions: NativeSignInAction[] = [];
  await startNativeRuntimeSignIn('cursor-agent', {
    command: process.execPath,
    prefix: [fixture, 'cursor'],
    signal: new AbortController().signal,
    onAction: (action) => actions.push(action),
    timeout: 3000,
  }).completion;
  expect(actions).toEqual([{ url: 'https://cursor.com/cli/auth?state=fixture-state' }]);
  await expect(
    startNativeRuntimeSignIn('cursor-agent', {
      command: process.execPath,
      prefix: [fixture, 'cursor-bad'],
      signal: new AbortController().signal,
      onAction: () => {},
      timeout: 3000,
    }).completion,
  ).rejects.toThrow('unsupported sign-in response');
});

it.each(['opencode', 'copilot-cli', 'grok'] as const)(
  'runs only %s native login in a real terminal with scoped/redacted output',
  async (runtime) => {
    const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-auth-methods-'));
    try {
      await withRuntimeConnection(
        runtime,
        runtime === 'opencode' ? { OPENAI_API_KEY: 'fixture-private-key' } : {},
        async () => {
          const actions: NativeSignInAction[] = [];
          const controller = new AbortController();
          let ready!: () => void;
          const prompt = new Promise<void>((resolve) => {
            ready = resolve;
          });
          const child = startNativeRuntimeSignIn(runtime, {
            command: process.execPath,
            prefix: [fixture, runtime === 'copilot-cli' ? 'copilot' : runtime],
            signal: controller.signal,
            onAction: (action) => {
              actions.push(action);
              if (
                action.interaction?.type === 'terminal' &&
                action.interaction.output.includes('auth-only')
              )
                ready();
            },
            timeout: 5000,
          });
          try {
            await Promise.race([
              prompt,
              child.completion.then(() => {
                throw new Error('The auth command ended without its prompt.');
              }),
            ]);
            expect(JSON.stringify(actions)).not.toContain('fixture-private-key');
            const first = actions.find(
              (action) => action.interaction?.type === 'terminal',
            )?.interaction;
            expect(first?.type).toBe('terminal');
            if (first?.type === 'terminal') {
              expect(first.output.length).toBeGreaterThan(0);
              expect(first.outputOffset).toBe(first.output.length);
            }
            child.respondInteraction!({
              type: 'terminal',
              data: 'fixture-response\r',
              size: { cols: 90, rows: 30 },
            });
            await child.completion;
            expect(actions.at(-1)?.interaction?.type).toBe('terminal');
            const last = actions.at(-1)?.interaction;
            if (last?.type === 'terminal') expect(last.outputOffset).toBe(last.output.length);
            expect(() => child.respond('unscoped')).toThrow('terminal response');
          } finally {
            controller.abort();
            await child.completion.catch(() => {});
          }
        },
        directory,
      );
    } finally {
      expect(dirname(resolve(directory))).toBe(resolve(tmpdir()));
      expect(basename(directory)).toMatch(/^pitchcrew-auth-methods-/);
      await rm(directory, { recursive: true, force: true });
    }
  },
);

it('signs out only the private Grok account even when an API key is configured', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-auth-methods-'));
  try {
    await writeFile(join(directory, 'auth.json'), '{}');
    await withRuntimeConnection(
      'grok',
      { XAI_API_KEY: 'fixture-key' },
      async () => {
        expect(nativeRuntimeCanLogout('grok')).toBe(true);
        await startNativeRuntimeSignOut('grok', {
          command: process.execPath,
          prefix: [fixture, 'logout'],
          signal: new AbortController().signal,
          onAction: () => {},
          timeout: 3000,
        }).completion;
        expect(nativeRuntimeCanLogout('grok')).toBe(false);
        await expect(access(join(directory, 'auth.json'))).rejects.toThrow();
      },
      directory,
    );
  } finally {
    expect(dirname(resolve(directory))).toBe(resolve(tmpdir()));
    expect(basename(directory)).toMatch(/^pitchcrew-auth-methods-/);
    await rm(directory, { recursive: true, force: true });
  }
});
