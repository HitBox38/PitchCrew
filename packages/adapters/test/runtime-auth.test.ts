import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { startNativeRuntimeSignIn, type NativeSignInAction } from '../src/runtime-auth/index.ts';
import { nativeSignInUrl } from '../src/runtime-auth/url.ts';

const fixture = fileURLToPath(new URL('./fixtures/runtime-auth.mjs', import.meta.url));
const launch = (mode: string, runtime: 'codex' | 'claude-code' = 'codex', timeout = 3000) => {
  const controller = new AbortController();
  const actions: NativeSignInAction[] = [];
  const child = startNativeRuntimeSignIn(runtime, {
    command: process.execPath,
    prefix: [fixture, mode],
    signal: controller.signal,
    onAction: (action) => actions.push(action),
    timeout,
  });
  return { controller, actions, child };
};

it('uses account login and metadata verification without a thread or model request', async () => {
  const { child, actions } = launch('success');
  await child.completion;
  expect(actions).toEqual([{ url: 'https://auth.openai.com/oauth/authorize?state=fixture-state' }]);
  expect(JSON.stringify(actions)).not.toContain('email');
});

it.each(['bad-url', 'missing-account', 'premature', 'failed', 'overflow'])(
  'rejects unsafe or unverified Codex completion: %s',
  async (mode) => {
    const { child, actions } = launch(mode);
    await expect(child.completion).rejects.toThrow();
    expect(JSON.stringify(actions)).not.toContain('example.invalid');
    await child.completion.catch((error: Error) =>
      expect(error.message).not.toContain('Secret fixture'),
    );
  },
);

it('ignores another login completion and times out rather than claiming success', async () => {
  const { child } = launch('mismatched', 'codex', 250);
  await expect(child.completion).rejects.toThrow('expired');
});

it('stops its owned native process on cancellation', async () => {
  const { child, actions, controller } = launch('waiting');
  const settled = child.completion.catch((error: Error) => error);
  await expect.poll(() => actions.length).toBe(1);
  controller.abort();
  expect(await settled).toBeInstanceOf(Error);
});

it('supports Claude’s native code fallback without exposing CLI output or retaining the code', async () => {
  const { child, actions } = launch('claude-code', 'claude-code');
  await expect.poll(() => actions.some((action) => action.codeRequested)).toBe(true);
  expect(() => child.respond('fixture-code\nextra-command')).toThrow('single-line');
  child.respond('fixture-code#fixture-state');
  await child.completion;
  expect(actions).toContainEqual({ url: 'https://claude.ai/oauth/authorize?state=fixture-state' });
  expect(actions).toContainEqual({ codeRequested: false });
  expect(JSON.stringify(actions)).not.toContain('fixture-code#');
});

it.each([
  'http://auth.openai.com/authorize',
  'https://auth.openai.com.evil.invalid/authorize',
  'https://user:pass@auth.openai.com/authorize',
  'https://auth.openai.com:444/authorize',
])('rejects non-provider OAuth link %s', (url) =>
  expect(() => nativeSignInUrl('codex', url)).toThrow(),
);
