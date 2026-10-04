import { access } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { createGoogleCliRunner } from '../src/connectors/auth/google-cli-process.ts';
const fixture = fileURLToPath(new URL('./fixtures/google-cli.mjs', import.meta.url));
const signal = () => new AbortController().signal;
const runner = (mode: string) => createGoogleCliRunner(process.execPath, [fixture, mode]);
afterEach(() => vi.unstubAllEnvs());
it('passes arguments literally, filters credential overrides and removes its working directory', async () => {
  vi.stubEnv('GOOGLE_WORKSPACE_CLI_TOKEN', 'fictional-token');
  vi.stubEnv('GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE', 'fictional-path');
  vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', 'fictional-adc');
  vi.stubEnv('RUST_LOG', 'debug');
  const result = await runner('inspect')(
    ['drive', 'files', 'list', '--params', '{"q":"; echo injected $(whoami)"}'],
    signal(),
  );
  const parsed = JSON.parse(result.stdout);
  expect(parsed.args.slice(0, 5)).toEqual([
    'drive',
    'files',
    'list',
    '--params',
    '{"q":"; echo injected $(whoami)"}',
  ]);
  expect(parsed.args[5]).toBe('--output');
  expect(dirname(parsed.args[6])).toBe(parsed.cwd);
  expect(parsed.overrides).toEqual([null, null, null]);
  expect(parsed.debug).toBeUndefined();
  await expect(access(parsed.cwd)).rejects.toThrow();
});
it('returns exact downloaded text and cleans up the file', async () => {
  const result = await runner('text')(['drive', 'files', 'export'], signal(), true);
  expect(result.text).toBe('Fictional text\n');
  expect(result.mimeType).toBe('text/plain; charset=utf-8');
  await expect(access(dirname(JSON.parse(result.stdout).saved_file))).rejects.toThrow();
});
it('supports JSON media printed by gws rather than downloaded', async () => {
  expect((await runner('json')(['drive', 'files', 'get'], signal(), true)).text).toBe(
    '{"fictional":"JSON content"}\n',
  );
});
it('rejects binary and unexpected metadata downloads', async () => {
  await expect(runner('binary')(['drive', 'files', 'get'], signal(), true)).rejects.toThrow(
    'not supported text',
  );
  await expect(runner('text')(['drive', 'files', 'get'], signal())).rejects.toThrow(
    'unsupported read response',
  );
});
it('bounds stdout and downloaded files', async () => {
  await expect(runner('oversize')(['--version'], signal())).rejects.toThrow('too large');
  await expect(runner('oversize-file')(['drive', 'files', 'get'], signal(), true)).rejects.toThrow(
    'too large',
  );
});
it('suppresses stderr and supports missing executables and cancellation', async () => {
  expect(await runner('error')(['auth', 'status'], signal())).toEqual({ exitCode: 1, stdout: '' });
  await expect(
    createGoogleCliRunner('pitchcrew-fictional-missing-gws')(['--version'], signal()),
  ).rejects.toThrow('Install Google Workspace CLI');
  const controller = new AbortController();
  const pending = runner('wait-file')(['drive', 'files', 'get'], controller.signal, true);
  const rejection = expect(pending).rejects.toThrow('cancelled');
  setTimeout(() => controller.abort(), 200);
  await rejection;
});
