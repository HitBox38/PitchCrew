import type { AppBuild } from '@pitchcrew/core';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import metadata from '../../../../package.json' with { type: 'json' };

export const commitPattern = /^[a-f0-9]{40}$/;

/** Installer metadata survives without Git. Source launches read HEAD once per daemon. */
export async function readAppBuild(
  root = new URL('../../../../', import.meta.url),
): Promise<AppBuild> {
  try {
    const value = JSON.parse(await readFile(new URL('build-info.json', root), 'utf8'));
    if (typeof value.commit === 'string' && commitPattern.test(value.commit))
      return { version: metadata.version, commit: value.commit, packaged: true };
  } catch {
    // Source checkouts and older installers have no build metadata.
  }
  try {
    const { stdout } = await promisify(execFile)('git', ['rev-parse', 'HEAD'], {
      cwd: fileURLToPath(root),
      timeout: 1000,
      maxBuffer: 1024,
      windowsHide: true,
    });
    const commit = stdout.trim();
    if (commitPattern.test(commit)) return { version: metadata.version, commit, packaged: false };
  } catch {
    // A missing build identity must never be reported as up to date.
  }
  return { version: metadata.version, commit: null, packaged: false };
}
