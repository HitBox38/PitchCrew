import type { Snapshot } from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);
const agent = {
  id: 'research-partner',
  name: 'Research partner',
  description: 'Investigate fictional opportunities.',
  runtime: 'demo',
  model: '',
  enabled: true,
  instructions: 'Report verified evidence.',
};

it('snapshot reads append no events', async () => {
  const { daemon, request } = await setup();
  const before = daemon.service.board.events(1000);
  for (const path of [
    '/snapshot',
    '/snapshot?view=workspace',
    '/snapshot',
    '/snapshot?view=workspace',
  ])
    expect((await request<Snapshot>(path)).response.status).toBe(200);
  expect(daemon.service.board.events(1000)).toEqual(before);
});

it('a new agent has its chat without a snapshot', async () => {
  const { daemon, request } = await setup();
  await daemon.service.createRole(agent);
  expect(daemon.service.board.get('conversation', agent.id)).toMatchObject({
    kind: 'direct',
    participants: [agent.id],
    leadId: agent.id,
  });
  const before = daemon.service.board.events(1000);
  const { result } = await request<Snapshot>('/snapshot');
  expect(result.conversations?.map((item) => item.id)).toContain(agent.id);
  expect(daemon.service.board.events(1000)).toEqual(before);
});
