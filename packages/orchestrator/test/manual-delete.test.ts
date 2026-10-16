import { states, type AgentTask, type Card, type Routine, type Run } from '@pitchcrew/core';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);

describe('user job deletion API', () => {
  it('deletes every status, preserves history after replay, and does not launch work', async () => {
    const { daemon, request } = await setup(14601);
    for (const state of states) {
      const card = daemon.service.createCard({ company: 'Fictional Studio', title: state });
      daemon.service.board.record('card', { ...card, state }, 'user', 'Fixture status');
      const before = daemon.service.board.history(card.id).length;
      const response = await request(`/cards/${card.id}`, 'DELETE');
      expect(response.response.status).toBe(200);
      expect(response.result).toEqual({ ok: true });
      expect(daemon.service.board.history(card.id)).toHaveLength(before + 1);
      expect(daemon.service.board.history(card.id)[0]).toMatchObject({
        actor: 'user',
        data: { state, deletedAt: expect.any(String) },
      });
    }
    expect(daemon.service.board.list('card')).toEqual([]);
    expect(daemon.service.board.list('run')).toEqual([]);
    daemon.service.board.rebuild();
    expect(daemon.service.board.list('card')).toEqual([]);
  });

  it('requires a UI session and rejects owners, workflow runs and attached chat runs without writes', async () => {
    const { daemon, request } = await setup(14602);
    const card = daemon.service.createCard({ company: 'Fictional Studio', title: 'Engineer' });
    const path = `/cards/${card.id}`;
    const before = daemon.service.board.events();
    const unauthorizedHeaders: Record<string, string>[] = [
      { cookie: '' },
      { 'x-pitchcrew-client': 'agent' },
    ];
    for (const headers of unauthorizedHeaders)
      expect((await request(path, 'DELETE', undefined, headers)).response.status).toBe(403);
    expect((await request('/cards/missing', 'DELETE')).response.status).toBe(400);
    expect(daemon.service.board.events()).toEqual(before);
    daemon.service.board.updateCard(card.id, { owner: 'scout' }, 'system', 'Fixture owner');
    const owned = daemon.service.board.events();
    expect((await request(path, 'DELETE')).response.status).toBe(400);
    expect(daemon.service.board.events()).toEqual(owned);
    daemon.service.board.updateCard(card.id, { owner: null }, 'system', 'Release fixture');
    for (const mode of ['workflow', 'chat'] as const) {
      const run = { id: 'fixture-active', cardId: card.id, status: 'running', mode } as Run;
      daemon.service.board.record('run', run, 'scout', 'Fixture active run');
      const busy = daemon.service.board.events();
      expect((await request(path, 'DELETE')).response.status).toBe(400);
      expect(daemon.service.board.events()).toEqual(busy);
      expect(daemon.service.board.get<Card>('card', card.id)).toMatchObject({ id: card.id });
      daemon.service.board.record(
        'run',
        { ...run, status: 'completed' },
        'scout',
        'Finish fixture',
      );
    }
    expect((await request(path, 'DELETE')).response.status).toBe(200);
    expect((await request(path, 'DELETE')).response.status).toBe(400);
  });

  it('cancels queued follow-ups and pauses only the deleted job’s routines', async () => {
    const { daemon, request } = await setup(14603);
    const card = daemon.service.createCard({ company: 'Fictional Studio', title: 'Engineer' });
    const other = daemon.service.createCard({ company: 'Other Studio', title: 'Engineer' });
    for (const id of [card.id, other.id]) {
      daemon.service.board.record(
        'task',
        { id: `task-${id}`, cardId: id, status: 'queued' } as AgentTask,
        'scout',
        'Fixture',
      );
      daemon.service.board.record(
        'routine',
        { id: `routine-${id}`, cardId: id, enabled: true, deletedAt: null } as Routine,
        'user',
        'Fixture',
      );
    }
    expect((await request(`/cards/${card.id}`, 'DELETE')).response.status).toBe(200);
    expect(daemon.service.board.get<AgentTask>('task', `task-${card.id}`).status).toBe('cancelled');
    expect(daemon.service.board.get<Routine>('routine', `routine-${card.id}`)).toMatchObject({
      enabled: false,
      nextRunAt: null,
    });
    expect(daemon.service.board.get<AgentTask>('task', `task-${other.id}`).status).toBe('queued');
    expect(daemon.service.board.get<Routine>('routine', `routine-${other.id}`).enabled).toBe(true);
  });
});
