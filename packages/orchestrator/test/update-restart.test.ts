import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { markUpdateRestart, verifyUpdateRestart } from '../src/background/update-restart.ts';

const directories: string[] = [];
const build = { version: '0.2.0', commit: 'b'.repeat(40), packaged: true };
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-update-restart-'));
  directories.push(directory);
  await markUpdateRestart(directory, '0.2.0');
  return directory;
}
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

it('verifies both version and exact commit before clearing a successful restart marker', async () => {
  const directory = await fixture();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response('', {
        headers: { 'set-cookie': 'pitchcrew_session=fixture; HttpOnly; SameSite=Strict' },
      }),
    )
    .mockResolvedValueOnce(Response.json({ current: build }));
  vi.stubGlobal('fetch', fetcher);
  await verifyUpdateRestart(directory, build, 'http://127.0.0.1:4417');
  expect(fetcher.mock.calls[1][1].headers).toEqual({
    cookie: 'pitchcrew_session=fixture',
    'x-pitchcrew-client': 'ui',
  });
  await expect(readFile(join(directory, 'update-restart.json'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

it.each([
  { ...build, version: '0.1.0' },
  { ...build, commit: 'a'.repeat(40) },
])('refuses a stale or unrelated daemon without deleting the marker (%j)', async (current) => {
  const directory = await fixture();
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', {
          headers: { 'set-cookie': 'pitchcrew_session=fixture' },
        }),
      )
      .mockResolvedValueOnce(Response.json({ current })),
  );
  await expect(verifyUpdateRestart(directory, build, 'http://127.0.0.1:4417')).rejects.toThrow(
    'previous daemon',
  );
  expect(await readFile(join(directory, 'update-restart.json'), 'utf8')).toContain('0.2.0');
});

it('reopening the previous app after a failed OS installation clears intent without network requests', async () => {
  const directory = await fixture();
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await verifyUpdateRestart(directory, { ...build, version: '0.1.0' }, 'http://127.0.0.1:4417');
  expect(fetcher).not.toHaveBeenCalled();
  await expect(readFile(join(directory, 'update-restart.json'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

it('rejects invalid marker versions before writing', async () => {
  const directory = await fixture();
  await expect(markUpdateRestart(directory, '../../installer')).rejects.toThrow('Invalid update');
  expect(await readFile(join(directory, 'update-restart.json'), 'utf8')).toContain('0.2.0');
});
