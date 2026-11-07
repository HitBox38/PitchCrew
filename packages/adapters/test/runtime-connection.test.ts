import { afterEach, expect, test, vi } from 'vitest';
import {
  withRuntimeConnection,
  runtimeConnectionDirectory,
  runtimeConnectionEnvironment,
  redactRuntimeConnectionSecrets,
  runtimeConnectionFields,
} from '../src/index.ts';
import { cliEnvironment, runtimeEnvironment } from '../src/process/environment.ts';
import { checkRuntimeAuthentication } from '../src/maintenance/authentication.ts';
import { redactMaintenanceOutput } from '../src/maintenance/process.ts';
import type { RunContext } from '@pitchcrew/core';

afterEach(() => vi.unstubAllEnvs());

test('keeps concurrent workspace credentials separate and lets run isolation override native paths', async () => {
  vi.stubEnv('CODEX_API_KEY', 'fictional-inherited-key');
  const values = await Promise.all([
    withRuntimeConnection(
      'codex',
      { CODEX_API_KEY: 'fictional-first-key' },
      async () => {
        await Promise.resolve();
        expect(runtimeConnectionDirectory()).toBe('fixture-first-auth');
        return cliEnvironment().CODEX_API_KEY;
      },
      'fixture-first-auth',
    ),
    withRuntimeConnection('codex', { CODEX_API_KEY: 'fictional-second-key' }, async () => {
      await Promise.resolve();
      return runtimeEnvironment(
        { mcp: { env: { PITCHCREW_CAPABILITY: 'fixture-capability' } } } as unknown as RunContext,
        { CODEX_HOME: 'fixture-isolated-home' },
      );
    }),
  ]);
  expect(values[0]).toBe('fictional-first-key');
  expect(values[1]).toMatchObject({
    CODEX_API_KEY: 'fictional-second-key',
    CODEX_HOME: 'fixture-isolated-home',
    PITCHCREW_CAPABILITY: 'fixture-capability',
  });
  expect(process.env.CODEX_API_KEY).toBe('fictional-inherited-key');
  expect(runtimeConnectionDirectory()).toBeUndefined();
});

test('explicit empty credentials disable inherited values and readiness reads the same scope', async () => {
  vi.stubEnv('KIRO_API_KEY', 'fictional-ambient-key');
  const disabled = await withRuntimeConnection('kiro-cli', { KIRO_API_KEY: '' }, () =>
    checkRuntimeAuthentication({ runtime: 'kiro-cli', model: '' }),
  );
  expect(disabled.status).toBe('missing');
  const configured = await withRuntimeConnection(
    'kiro-cli',
    { KIRO_API_KEY: 'fictional-scoped-key' },
    () => checkRuntimeAuthentication({ runtime: 'kiro-cli', model: '' }),
  );
  expect(configured.status).toBe('unknown');
  expect(configured.detail).toContain('configured');
  expect(process.env.KIRO_API_KEY).toBe('fictional-ambient-key');
});

test('rejects startup, filesystem and tool configuration controls before entering a connection scope', () => {
  for (const name of [
    'PATH',
    'HOME',
    'NODE_OPTIONS',
    'PITCHCREW_CAPABILITY',
    'OPENCODE_CONFIG_CONTENT',
    'CLAUDE_CONFIG_DIR',
  ])
    expect(() => withRuntimeConnection('codex', { [name]: 'fictional-value' }, () => {})).toThrow(
      'not supported',
    );
  expect(() =>
    withRuntimeConnection('hermes', { HERMES_INFERENCE_PROVIDER: 'agent-cli' }, () => {}),
  ).toThrow('supported values');
  expect(
    runtimeConnectionFields('codex').find((field) => field.name === 'CODEX_API_KEY')?.secret,
  ).toBe(true);
});

test('redacts scoped secrets from accumulated native output without mutating the host environment', () => {
  vi.stubEnv('CODEX_API_KEY', 'fictional-inherited-key');
  withRuntimeConnection('codex', { CODEX_API_KEY: 'fictional-workspace-key' }, () => {
    const accumulated = 'prefix fictional-workspace-' + 'key suffix';
    expect(redactRuntimeConnectionSecrets(accumulated)).toBe('prefix [redacted] suffix');
    expect(redactMaintenanceOutput(accumulated)).not.toContain('fictional-workspace-key');
    expect(runtimeConnectionEnvironment().CODEX_API_KEY).toBe('fictional-workspace-key');
  });
});
