import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import {
  runtimeCommand,
  runtimeExecutable,
  withRuntimeExecutables,
} from '../src/process/executable.ts';
import { detectCli } from '../src/process/health.ts';
import { findRuntimeExecutable } from '../src/maintenance/installation.ts';

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) {
    if (
      dirname(resolve(folder)) !== resolve(tmpdir()) ||
      !basename(folder).startsWith('pitchcrew-executable-')
    )
      throw new Error('Unsafe fixture cleanup path.');
    await rm(folder, { recursive: true, force: true });
  }
});

it('keeps concurrent workspace choices isolated across asynchronous metadata and launch work', async () => {
  const first = join(tmpdir(), 'fixture-first-codex');
  const second = join(tmpdir(), 'fixture-second-codex');
  await Promise.all(
    [first, second].map((path) =>
      withRuntimeExecutables({ codex: path }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(runtimeExecutable('codex')).toBe(path);
        expect(runtimeCommand('codex', ['--version'])).toEqual({ file: path, args: ['--version'] });
      }),
    ),
  );
  expect(runtimeExecutable('codex')).toBe('codex');
  expect(runtimeExecutable('node')).toBe('node');
});

it('uses the configured executable in both detection and installation resolution', async () => {
  await withRuntimeExecutables({ codex: process.execPath }, async () => {
    expect(await findRuntimeExecutable('codex')).toBe(process.execPath);
    const health = await detectCli('codex', 'codex');
    expect(health.available).toBe(true);
    expect(health.version).toMatch(/^v\d+\./);
  });
});

it('does not silently use PATH when a configured executable disappears', async () => {
  await withRuntimeExecutables({ codex: join(tmpdir(), 'fixture-not-present-codex') }, async () => {
    expect(await findRuntimeExecutable('codex')).toBeNull();
    expect((await detectCli('codex', 'codex')).available).toBe(false);
  });
});

it('normalizes npm Windows command shims without invoking a shell and preserves arguments', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'pitchcrew-executable-'));
  folders.push(folder);
  const target = join(folder, 'node_modules', 'fixture-cli', 'cli.js');
  await mkdir(join(folder, 'node_modules', 'fixture-cli'), { recursive: true });
  await writeFile(target, 'console.log("fixture");');
  const shim = join(folder, 'codex.cmd');
  await writeFile(shim, '@ECHO off\n"%_prog%" "%dp0%\\node_modules\\fixture-cli\\cli.js" %*\n');
  // Windows separators are meaningful to the real platform resolver; use its native form here.
  await writeFile(
    shim,
    `@ECHO off\n"%_prog%" "%dp0%/${['node_modules', 'fixture-cli', 'cli.js'].join('/')}" %*\n`,
  );
  const invocation = withRuntimeExecutables({ codex: shim }, () =>
    runtimeCommand('codex', ['value; remains one argument']),
  );
  expect(invocation.args).toEqual([target, 'value; remains one argument']);
  expect(invocation.file).not.toMatch(/cmd\.exe|powershell/i);
  await writeFile(shim, '"%_prog%" "%dp0%/../escaped.js" %*');
  expect(() => runtimeCommand(shim, [])).toThrow('outside node_modules');
});
