import { writePacket } from '@pitchcrew/packet';
import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { packet } from '../../board/test/fixtures/packet.ts';
import { packetFolderOpen } from '../src/crew/packet-folder.ts';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);

const opened: string[] = [];
const original = packetFolderOpen.current;
afterEach(() => {
  packetFolderOpen.current = original;
  opened.length = 0;
});

it('reports and opens a job packet directory only when it has saved files', async () => {
  packetFolderOpen.current = async (path) => {
    opened.push(path);
  };
  const { daemon, directory, request } = await setup();
  const card = daemon.service.createCard({ company: 'Fictional Studio', title: 'Engineer' });
  const path = `/cards/${card.id}/packet-folder`;

  expect((await request<{ available: boolean }>(path)).result).toEqual({ available: false });
  const missing = await request<{ error: string }>(path, 'POST');
  expect(missing.response.status).toBe(400);
  expect(missing.result.error).toBe('This job has no packet files.');
  expect(opened).toEqual([]);

  await writePacket(directory, card.id, packet);
  expect((await request<{ available: boolean }>(path)).result).toEqual({ available: true });
  const openedFolder = await request<{ ok: boolean }>(path, 'POST');
  expect(openedFolder.response.status).toBe(200);
  expect(openedFolder.result).toEqual({ ok: true });
  expect(opened).toEqual([await realpath(join(directory, 'packets', card.id))]);

  packetFolderOpen.current = async () => {
    throw new Error('explorer failed at C:\\secret\\packets');
  };
  const failed = await request<{ error: string }>(path, 'POST');
  expect(failed.response.status).toBe(400);
  expect(failed.result.error).toBe('Could not open the packet folder.');
});

it('rejects unknown jobs and requests without the user session', async () => {
  const { daemon, request } = await setup();
  const card = daemon.service.createCard({ company: 'Fictional Studio', title: 'Engineer' });
  expect(
    (await request('/cards/00000000-0000-4000-8000-000000000000/packet-folder')).response.status,
  ).toBe(400);
  expect((await request('/cards/not-a-job/packet-folder')).response.status).toBe(400);
  const anonymous = await fetch(`${daemon.url}/api/cards/${card.id}/packet-folder`);
  expect(anonymous.status).toBe(403);
  const posted = await fetch(`${daemon.url}/api/cards/${card.id}/packet-folder`, {
    method: 'POST',
  });
  expect(posted.status).toBe(403);
});
