import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppBuild } from '@pitchcrew/core';

/** A relaunched desktop verifies its new daemon instead of silently reusing the previous build. */
export const markUpdateRestart = async (directory: string, version: unknown) => {
  if (typeof version !== 'string' || !versionPattern.test(version))
    throw new Error('Invalid update version.');
  await writeFile(join(directory, fileName), JSON.stringify({ version }), { mode: 0o600 });
};

export const verifyUpdateRestart = async (directory: string, build: AppBuild, url: string) => {
  const text = await readFile(join(directory, fileName), 'utf8').catch(() => null);
  if (text === null) return;
  const expected = JSON.parse(text) as { version?: unknown };
  if (expected.version === build.version) {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(2000) });
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    await response.body?.cancel();
    if (!cookie) throw new Error('Could not verify the daemon after updating.');
    const info = await fetch(`${url}/api/app-updates`, {
      redirect: 'error',
      signal: AbortSignal.timeout(2000),
      headers: { cookie, 'x-pitchcrew-client': 'ui' },
    });
    const data = (await info.json()) as { current?: AppBuild };
    if (
      !info.ok ||
      data.current?.version !== build.version ||
      !build.commit ||
      data.current.commit !== build.commit
    )
      throw new Error(
        'The previous daemon is still running. Stop it and reopen the updated Pitchcrew app.',
      );
  }
  // Reopening the previous build after a failed OS installer is a supported recovery path.
  await clearUpdateRestart(directory);
};

const fileName = 'update-restart.json';
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export const clearUpdateRestart = (directory: string) =>
  rm(join(directory, fileName), { force: true });
