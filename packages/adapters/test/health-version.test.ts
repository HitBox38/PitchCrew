import { beforeEach, expect, it, vi } from 'vitest';
import { detectCli } from '../src/process/health.ts';
import { hermesVersion } from '../src/hermes/version.ts';

const fixture = vi.hoisted(() => ({ stdout: '' }));
vi.mock('node:child_process', () => ({
  // promisify resolves this single fixture result exactly as execFile's custom promisifier does.
  execFile: vi.fn((_command, _args, _options, callback) =>
    callback(null, { stdout: fixture.stdout, stderr: '' }),
  ),
}));
beforeEach(() => vi.clearAllMocks());

it('normalizes the full provider banner before enforcing the bounded version display', async () => {
  fixture.stdout = `${'Fixture startup notice. '.repeat(12)}\nHermes Agent v0.22.2 (stable)\nPython: 3.14.7`;
  expect(await detectCli('hermes', 'hermes', hermesVersion)).toMatchObject({
    available: true,
    version: '0.22.2',
  });
});

it('retains the existing trimmed 100-character behavior for other CLI callers', async () => {
  fixture.stdout = `  codex-cli 1.2.3\n${'fixture details '.repeat(12)}  `;
  expect(await detectCli('codex', 'codex')).toMatchObject({
    available: true,
    version: fixture.stdout.trim().slice(0, 100),
  });
});
