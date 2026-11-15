import type { Card } from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import type { CardChangesPage } from '../src/http/routes/card-changes.ts';
import { cleanup, setup } from './helpers/daemon.ts';
afterEach(cleanup);

const packet = (resume: string) => ({
  resume,
  coverLetter: 'Fictional cover letter.',
  formAnswers: '',
  note: '',
  claims: [],
});

it('pages a job’s status moves and drafts from its saved events', async () => {
  const { daemon, request } = await setup();
  const board = daemon.service.board;
  const card = daemon.service.createCard({ company: 'Fictional Studio', title: 'Engineer' });
  board.move(card.id, 'shortlisted', 'user', 'User changed status to shortlisted');
  board.updateCard(card.id, { packet: packet('First draft.') }, 'writer', 'Drafted packet');
  board.move(card.id, 'drafting', 'writer');
  // The move above is the oldest event of the newest page; its baseline is the extra event.
  for (let index = 0; index < 199; index++)
    board.record('card', board.get<Card>('card', card.id), 'user', `Note ${index}`);

  const first = (await request<CardChangesPage>(`/cards/${card.id}/changes`)).result;
  expect(first.changes).toEqual([expect.objectContaining({ state: 'drafting', actor: 'writer' })]);
  expect(first.older).toBe(first.changes[0]!.id);
  expect(first.reachedAt).toBe(first.changes[0]!.at);

  const second = (await request<CardChangesPage>(`/cards/${card.id}/changes?before=${first.older}`))
    .result;
  expect(second.changes.map(({ actor, state, packet }) => ({ actor, state, packet }))).toEqual([
    { actor: 'writer', state: undefined, packet: 'drafted' },
    { actor: 'user', state: 'shortlisted', packet: undefined },
  ]);
  expect(second.older).toBeNull();
  expect(Object.keys(second.changes[0]!).toSorted()).toEqual(['actor', 'at', 'id', 'packet']);
});

it('rejects unknown jobs, invalid cursors and requests without the user session', async () => {
  const { daemon, request } = await setup();
  const card = daemon.service.createCard({ company: 'Fictional Studio', title: 'Engineer' });
  expect((await request(`/cards/${card.id}/changes?before=0`)).response.status).toBe(400);
  expect(
    (await request('/cards/00000000-0000-4000-8000-000000000000/changes')).response.status,
  ).toBeGreaterThanOrEqual(400);
  const anonymous = await fetch(`${daemon.url}/api/cards/${card.id}/changes`);
  expect(anonymous.status).toBe(403);
});
