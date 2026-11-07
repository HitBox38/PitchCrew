import { afterEach, expect, test, vi } from 'vitest';
import { withRuntimeConnection } from '../src/process/runtime-connection.ts';
import { runtimeConnectionFields } from '../src/process/runtime-connection-fields.ts';
import { checkRuntimeAuthentication } from '../src/maintenance/authentication.ts';
import * as account from '../src/maintenance/account.ts';
import * as installation from '../src/maintenance/installation.ts';
import { runCliText } from '../src/process/launch.ts';
import { contextFor, cleanup } from './helpers/runtime.ts';

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanup();
});

test('uses CODEX_API_KEY for the exec connection while other runtimes keep their OpenAI key field', () => {
  expect(
    runtimeConnectionFields('codex').find((field) => field.name === 'CODEX_API_KEY')?.secret,
  ).toBe(true);
  expect(() =>
    withRuntimeConnection('codex', { OPENAI_API_KEY: 'fictional-wrong-control' }, () => {}),
  ).toThrow('not supported');
  expect(
    runtimeConnectionFields('opencode').find((field) => field.name === 'OPENAI_API_KEY')?.secret,
  ).toBe(true);
});

test('a configured or inherited exec key remains unverified and bypasses the unrelated native account probe', async () => {
  vi.stubEnv('CODEX_API_KEY', 'fictional-inherited-key');
  const executable = vi
    .spyOn(installation, 'findRuntimeExecutable')
    .mockResolvedValue('/fictional/codex');
  const native = vi
    .spyOn(account, 'readCodexAccount')
    .mockResolvedValue({ account: { type: 'chatgpt' }, requiresOpenaiAuth: true });
  const config = { runtime: 'codex' as const, model: '' };
  const sources: Array<Record<string, string>> = [{}, { CODEX_API_KEY: 'fictional-saved-key' }];
  for (const source of sources) {
    const readiness = await withRuntimeConnection('codex', source, () =>
      checkRuntimeAuthentication(config),
    );
    expect(readiness.status).toBe('unknown');
    expect(readiness.detail).toContain('CODEX_API_KEY');
    expect(readiness.detail).toContain('not been verified');
    expect(JSON.stringify(readiness)).not.toMatch(/fictional-(?:saved|inherited)-key/);
  }
  expect(executable).not.toHaveBeenCalled();
  expect(native).not.toHaveBeenCalled();
  const nativeFallback = await withRuntimeConnection('codex', { CODEX_API_KEY: '' }, () =>
    checkRuntimeAuthentication(config),
  );
  expect(nativeFallback.status).toBe('authenticated');
  expect(native).toHaveBeenCalledOnce();
});

test('passes the configured exec override to a genuine child without changing native isolation or exposing its value', async () => {
  vi.stubEnv('CODEX_API_KEY', 'fictional-inherited-key');
  const context = await contextFor('grok');
  context.role.runtime = 'codex';
  const script =
    'process.stdout.write(JSON.stringify({type:"fixture",text:JSON.stringify({execKey:process.env.CODEX_API_KEY==="fictional-scoped-exec-key",mcp:process.env.PITCHCREW_RUN_TOKEN==="fictional-token"})})+"\\n")';
  const output = await withRuntimeConnection(
    'codex',
    { CODEX_API_KEY: 'fictional-scoped-exec-key' },
    () =>
      runCliText(process.execPath, ['-e', script], context, '', (event) =>
        event.type === 'fixture' && typeof event.text === 'string' ? event.text : null,
      ),
  );
  expect(JSON.parse(output)).toEqual({ execKey: true, mcp: true });
  expect(output).not.toContain('fictional-scoped-exec-key');
  expect(process.env.CODEX_API_KEY).toBe('fictional-inherited-key');
});
