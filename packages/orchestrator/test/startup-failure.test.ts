import { adapters } from '@pitchcrew/adapters';
import type { SkillPreview } from '@pitchcrew/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { createDaemon } from '../src/server.ts';
import { skillDirectory } from '../src/skills-directory.ts';

const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

it('aborts overlapping starter reads when runtime setup fails and releases the data-directory lock', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-test-startup-failure-'));
  directories.push(directory);
  for (const adapter of Object.values(adapters))
    vi.spyOn(adapter, 'detect').mockResolvedValue({
      id: adapter.id,
      available: false,
      version: '',
      detail: 'Fixture.',
    });
  vi.mocked(adapters.codex.detect).mockRejectedValue(new Error('Fixture runtime check failed.'));
  let aborted = 0;
  const preview = vi.spyOn(skillDirectory, 'preview').mockImplementation(
    (_url, signal) =>
      new Promise<SkillPreview>((_resolve, reject) => {
        signal!.addEventListener(
          'abort',
          () => {
            aborted++;
            reject(new Error('Fixture source cancelled.'));
          },
          { once: true },
        );
      }),
  );
  await expect(createDaemon({ directory, port: 15012 })).rejects.toThrow(
    'Fixture runtime check failed.',
  );
  expect(preview).toHaveBeenCalledTimes(10);
  expect(aborted).toBe(10);
  // A clean retry must own the folder, seed normal paused roles and contain no partial skills.
  vi.mocked(adapters.codex.detect).mockResolvedValue({
    id: 'codex',
    available: false,
    version: '',
    detail: 'Fixture.',
  });
  const daemon = await createDaemon({ directory, port: 15012, seedSkills: false });
  try {
    expect(daemon.service.skills()).toEqual([]);
    expect(daemon.service.board.list('role')).toHaveLength(8);
  } finally {
    await daemon.close();
  }
});
