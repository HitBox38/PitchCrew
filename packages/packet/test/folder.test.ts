import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { savedPacketFolder } from '../src/folder.ts';

const directories: string[] = [];
const temp = async (prefix: string) => {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  directories.push(directory);
  return directory;
};
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

it('returns the job directory only when a saved file is inside it', async () => {
  const directory = await temp('pitchcrew-packet-folder-');
  const cardId = randomUUID();
  expect(await savedPacketFolder(directory, cardId)).toBeNull();
  expect(await savedPacketFolder(directory, '../outside')).toBeNull();

  const folder = join(directory, 'packets', cardId);
  const staging = join(folder, '.try-unfinished');
  await mkdir(staging, { recursive: true });
  await writeFile(join(staging, 'resume.md'), 'Not saved yet.');
  expect(await savedPacketFolder(directory, cardId)).toBeNull();

  await mkdir(join(folder, 'try-ready'));
  await writeFile(join(folder, 'try-ready', 'resume.md'), 'Fictional resume.');
  expect(await savedPacketFolder(directory, cardId)).toBe(await realpath(folder));
});

it('ignores a packet directory that resolves outside the data folder', async () => {
  const directory = await temp('pitchcrew-packet-folder-');
  const outside = await temp('pitchcrew-packet-outside-');
  const cardId = randomUUID();
  await writeFile(join(outside, 'resume.md'), 'Fictional resume.');
  await mkdir(join(directory, 'packets'));
  await symlink(
    outside,
    join(directory, 'packets', cardId),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  expect(await savedPacketFolder(directory, cardId)).toBeNull();
});
