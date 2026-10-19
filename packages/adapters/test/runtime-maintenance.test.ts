import { afterEach, describe, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, symlink, rm, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  checkRuntimeAuthentication,
  compareRuntimeVersions,
  latestRuntimeVersion,
  redactMaintenanceOutput,
  resolveRuntimeInstallation,
  runMaintenanceCommand,
} from '../src/maintenance/index.ts';
import { readCodexAccount } from '../src/maintenance/account.ts';
import * as installation from '../src/maintenance/installation.ts';
import * as command from '../src/maintenance/process.ts';

const fixture = fileURLToPath(new URL('./fixtures/runtime-maintenance.ts', import.meta.url));
const prefix = ['--import', import.meta.resolve('tsx'), fixture];
const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('bounded maintenance subprocess contracts', () => {
  it('reads account metadata without creating a thread or inference turn', async () => {
    expect(await readCodexAccount(process.execPath, undefined, [...prefix, 'account'])).toEqual({
      account: { type: 'apiKey' },
      requiresOpenaiAuth: false,
    });
  });
  it('retains literal argv and reports output from a real subprocess', async () => {
    const args = ['a b', '$(do-not-run)', '`do-not-run`', '&literal'];
    const result = await runMaintenanceCommand({
      file: process.execPath,
      args: [...prefix, 'args', ...args],
    });
    expect(JSON.parse(result.stdout)).toEqual(args);
  });
  it('bounds output and terminates a timed-out child', async () => {
    await expect(
      runMaintenanceCommand({ file: process.execPath, args: [...prefix, 'large'] }),
    ).rejects.toThrow('output exceeded');
    await expect(
      runMaintenanceCommand(
        { file: process.execPath, args: [...prefix, 'hang'] },
        { timeout: 200 },
      ),
    ).rejects.toThrow('timed out');
  });
  it('cancels and redacts terminal output and environment secrets', async () => {
    vi.stubEnv('EXAMPLE_API_KEY', 'fictional-sensitive-key');
    expect(
      redactMaintenanceOutput('\u001b[31mfictional-sensitive-key Bearer abcdef\u001b[0m'),
    ).toBe('[redacted] Bearer [redacted]');
    const controller = new AbortController();
    controller.abort();
    await expect(
      runMaintenanceCommand({ file: process.execPath, args: [] }, { signal: controller.signal }),
    ).rejects.toThrow();
  });
});

describe('authentication follows the launch configuration', () => {
  it('distinguishes a missing required variable from a present but unverified one', async () => {
    vi.stubEnv('KIRO_API_KEY', '');
    expect((await checkRuntimeAuthentication({ runtime: 'kiro-cli', model: '' })).status).toBe(
      'missing',
    );
    vi.stubEnv('KIRO_API_KEY', 'fictional-key');
    expect((await checkRuntimeAuthentication({ runtime: 'kiro-cli', model: '' })).status).toBe(
      'unknown',
    );
  });
  it('does not block a local provider because a different provider lacks its key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(
      (await checkRuntimeAuthentication({ runtime: 'pi', model: 'anthropic/example' })).status,
    ).toBe('missing');
    expect(
      (await checkRuntimeAuthentication({ runtime: 'pi', model: 'ollama/example' })).status,
    ).toBe('unknown');
  });
  it('checks Claude with empty setting sources and treats malformed probes as unknown', async () => {
    vi.spyOn(installation, 'findRuntimeExecutable').mockResolvedValue('/fictional/claude');
    const run = vi
      .spyOn(command, 'runMaintenanceCommand')
      .mockResolvedValue({ code: 0, stdout: '{"loggedIn":true}', stderr: '' });
    expect((await checkRuntimeAuthentication({ runtime: 'claude-code', model: '' })).status).toBe(
      'authenticated',
    );
    expect(run.mock.calls[0][0].args).toEqual([
      '--setting-sources',
      '',
      'auth',
      'status',
      '--json',
    ]);
    run.mockResolvedValue({ code: 1, stdout: 'unsupported', stderr: '' });
    expect((await checkRuntimeAuthentication({ runtime: 'claude-code', model: '' })).status).toBe(
      'unknown',
    );
  });
});

it('proves npm ownership and pins the original prefix without invoking an installer', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pitchcrew-runtime-install-'));
  directories.push(root);
  const bin = join(root, 'bin');
  await mkdir(bin);
  const cli = join(root, 'lib/node_modules/@openai/codex/bin/codex.js');
  const npm = join(root, 'lib/node_modules/npm/bin/npm-cli.js');
  await mkdir(join(root, 'lib/node_modules/@openai/codex/bin'), { recursive: true });
  await mkdir(join(root, 'lib/node_modules/npm/bin'), { recursive: true });
  await writeFile(cli, '#!/usr/bin/env node\n', { mode: 0o700 });
  await writeFile(npm, '// fixture');
  if (process.platform === 'win32') {
    await writeFile(
      join(bin, 'codex.cmd'),
      '@"%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js"',
    );
    await mkdir(join(bin, 'node_modules/npm/bin'), { recursive: true });
    await writeFile(join(bin, 'node_modules/npm/bin/npm-cli.js'), '// fixture');
  } else await symlink(cli, join(bin, 'codex'));
  vi.stubEnv('PATH', bin);
  const result = await resolveRuntimeInstallation('codex');
  expect(result?.installer).toBe('npm');
  expect(result?.command?.args).toContain('--prefix');
  expect(result?.command?.args).toContain(
    await realpath(process.platform === 'win32' ? bin : root),
  );
  expect(result?.command?.file).toBe(process.execPath);
});

it('validates stable release metadata and never offers a downgrade', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ name: '@openai/codex', version: '1.2.0' }))),
  );
  const install = {
    executable: '/fixture/codex',
    realPath: '/fixture/codex',
    identity: 'fixture',
    installer: 'manual' as const,
    manualCommand: '',
    detail: '',
  };
  expect(await latestRuntimeVersion('codex', install)).toBe('1.2.0');
  expect(compareRuntimeVersions('1.2.0', '1.3.0')).toBe(-1);
  expect(compareRuntimeVersions('unknown', '1.3.0')).toBeNull();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response(JSON.stringify({ name: '@openai/codex', version: '2.0.0-beta.1' })),
    ),
  );
  await expect(latestRuntimeVersion('codex', install)).rejects.toThrow('invalid stable');
});

it('refuses interactive password prompts instead of leaving an installer waiting', async () => {
  await expect(
    runMaintenanceCommand(
      { file: process.execPath, args: [...prefix, 'prompt'] },
      { rejectPrompts: true },
    ),
  ).rejects.toThrow('interactive input');
});
