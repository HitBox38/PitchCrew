import { states, type Card, type Run } from '@pitchcrew/core';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);

describe('manual board status API', () => {
  it('accepts every user status pair without generating packets, approvals, exports or runs', async () => {
    const { daemon, request } = await setup(14590);
    const card = daemon.service.createCard({ company: 'Fictional Studio', title: 'Engineer' });
    for (const from of states)
      for (const to of states) {
        daemon.service.board.record('card', { ...card, state: from }, 'system', 'Fictional source');
        const moved = await request<Card>(`/cards/${card.id}/status`, 'POST', { state: to });
        expect(moved.response.status, `${from} to ${to}`).toBe(200);
        expect(moved.result).toMatchObject({ id: card.id, state: to, packet: null, owner: null });
      }
    expect(daemon.service.board.list('run')).toEqual([]);
    expect(daemon.service.board.list('approval')).toEqual([]);
    const final = daemon.service.board.get<Card>('card', card.id);
    daemon.service.board.rebuild();
    expect(daemon.service.board.get<Card>('card', card.id)).toEqual(final);
  });

  it('requires a local UI session and rechecks status validity and active work', async () => {
    const { daemon, request } = await setup(14591);
    const card = daemon.service.createCard({ company: 'Fictional Studio', title: 'Engineer' });
    const path = `/cards/${card.id}/status`;
    const before = daemon.service.board.events();
    const unauthorizedHeaders: Record<string, string>[] = [
      { cookie: '' },
      { 'x-pitchcrew-client': 'agent' },
    ];
    for (const extra of unauthorizedHeaders)
      expect((await request(path, 'POST', { state: 'offer' }, extra)).response.status).toBe(403);
    expect((await request(path, 'POST', { state: 'unknown' })).response.status).toBe(400);
    expect(
      (await request('/cards/missing/status', 'POST', { state: 'lead' })).response.status,
    ).toBe(400);
    expect(daemon.service.board.events()).toEqual(before);
    daemon.service.board.record(
      'run',
      {
        id: 'attached-chat',
        roleId: 'scout',
        cardId: card.id,
        mode: 'chat',
        status: 'running',
        runtime: 'demo',
        startedAt: '',
        finishedAt: null,
        message: '',
      } as Run,
      'scout',
      'Fictional attached chat',
    );
    expect((await request(path, 'POST', { state: 'submitted' })).response.status).toBe(400);
    expect(daemon.service.board.get<Card>('card', card.id).state).toBe('lead');
  });
});
