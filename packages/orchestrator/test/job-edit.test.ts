import type { Card } from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';
afterEach(cleanup);

it('updates a job through the user session endpoint and keeps stale or invalid writes from changing it', async () => {
  const { daemon, request } = await setup(15634);
  const card = daemon.service.createCard({
    company: 'Fixture Studio',
    title: 'Engineer',
    description: 'Original listing',
  });
  const input = {
    company: 'Edited Studio',
    title: 'Senior Engineer',
    location: '',
    salary: '$100k',
    url: 'https://example.com/edited',
    description: 'Edited listing',
    tags: ['edited'],
    expectedUpdatedAt: card.updatedAt,
  };
  const anonymous = await fetch(`${daemon.url}/api/cards/${card.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  expect(anonymous.ok).toBe(false);
  expect(daemon.service.board.get<Card>('card', card.id)).toEqual(card);
  const { response, result } = await request<Card>(`/cards/${card.id}`, 'PUT', input);
  expect(response.status).toBe(200);
  expect(result).toMatchObject({
    id: card.id,
    company: 'Edited Studio',
    state: 'lead',
    description: 'Edited listing',
    tags: ['edited'],
  });
  const events = daemon.service.board.events();
  const stale = await request(`/cards/${card.id}`, 'PUT', {
    ...input,
    expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
  });
  expect(stale.response.ok).toBe(false);
  const invalid = await request(`/cards/${card.id}`, 'PUT', {
    ...input,
    expectedUpdatedAt: result.updatedAt,
    state: 'submitted',
  });
  expect(invalid.response.ok).toBe(false);
  expect(daemon.service.board.events()).toEqual(events);
  expect(daemon.service.board.list<Card>('card')).toHaveLength(1);
});
