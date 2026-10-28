import {
  cardInput,
  defaultCapabilities,
  states,
  type Card,
  type Role,
  type Run,
} from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cleanup, finish, resources, setup } from './helpers/daemon.ts';

const scopedRun = (
  daemon: Awaited<ReturnType<typeof setup>>['daemon'],
  cardId: string | null = null,
) => {
  const id = 'board-fixture';
  daemon.service.board.record(
    'run',
    {
      id,
      cardId,
      roleId: 'scout',
      runtime: 'demo',
      mode: 'chat',
      status: 'running',
      message: 'Fixture',
      startedAt: new Date().toISOString(),
      finishedAt: null,
    } satisfies Run,
    'scout',
    'Fixture',
  );
  daemon.service.controllers.set(id, new AbortController());
  daemon.service.capabilities.set('board-token', { runId: id, roleId: 'scout', cardId });
  return 'board-token';
};

afterEach(async () => {
  for (const { daemon } of resources) daemon.service.controllers.delete('board-fixture');
  await cleanup();
});

it('lists bounded summaries and changes or deletes explicit jobs from an unattached chat over HTTP', async () => {
  const { daemon, request } = await setup(19575);
  const board = daemon.service.board;
  const card = board.createCard(
    cardInput.parse({
      company: 'First Fixture',
      title: 'Engineer',
      description: 'Private posting text',
    }),
  );
  const other = board.createCard(cardInput.parse({ company: 'Other Fixture', title: 'Engineer' }));
  const token = scopedRun(daemon);
  const agent = <T>(body: unknown) =>
    request<T>('/agent', 'POST', body, { authorization: `Bearer ${token}` });
  const listed = await agent<{ jobs: { id: string }[]; nextOffset: number }>({
    action: 'jobs',
    input: { limit: 1 },
  });
  expect(listed.response.status).toBe(200);
  expect(listed.result).toEqual({
    jobs: [
      {
        id: card.id,
        company: card.company,
        title: card.title,
        state: 'lead',
        location: 'Remote',
        url: '',
      },
    ],
    nextOffset: 1,
  });
  expect((await agent({ action: 'jobs', input: { offset: 1, limit: 1 } })).result).toMatchObject({
    jobs: [{ id: other.id }],
    nextOffset: null,
  });
  for (const state of states) {
    const moved = await agent({
      action: 'workflow',
      cardId: card.id,
      state,
      reason: 'User requested\nboard correction',
    });
    expect(moved.response.status).toBe(200);
    expect(moved.result).toMatchObject({ card: { id: card.id, state } });
    if (state !== 'lead')
      expect(board.history(card.id)[0].message).toBe(
        `Moved to ${state.replaceAll('_', ' ')}: User requested board correction`,
      );
  }
  const before = board.events();
  expect(
    (await agent({ action: 'workflow', cardId: other.id, state: 'invalid', reason: 'Bad status' }))
      .response.status,
  ).toBe(400);
  expect(
    (await agent({ action: 'delete_job', cardId: other.id, reason: ' ' })).response.status,
  ).toBe(400);
  expect(
    (await agent({ action: 'delete_job', cardId: 'invalid', reason: 'Bad ID' })).response.status,
  ).toBe(400);
  expect(board.events()).toEqual(before);
  expect(
    (await agent({ action: 'delete_job', cardId: card.id, reason: 'Remove unwanted job' })).result,
  ).toMatchObject({ ok: true, cardId: card.id });
  expect((await daemon.service.snapshot()).cards).toEqual([other]);
  expect(board.list('approval')).toEqual([]);
  expect(board.list('submission_attempt')).toEqual([]);
  board.rebuild();
  expect(board.list('card')).toEqual([other]);
});

it('uses attached jobs by default and checks current permissions, pause and cancellation on each call', async () => {
  const { daemon } = await setup(19576);
  const board = daemon.service.board;
  const card = board.createCard(cardInput.parse({ company: 'Fixture', title: 'Engineer' }));
  const token = scopedRun(daemon, card.id);
  await daemon.service.agentCall(token, 'workflow', {
    state: 'offer',
    reason: 'Correct local outcome',
  });
  expect(board.get<Card>('card', card.id).state).toBe('offer');
  const role = board.get<Role>('role', 'scout');
  const calls = [
    ['jobs', {}],
    ['workflow', { state: 'lead', reason: 'Reopen' }],
    ['delete_job', { reason: 'Remove' }],
    ['bulk_move_jobs', { input: { cardIds: [card.id], state: 'lead', reason: 'Reopen' } }],
    ['bulk_delete_jobs', { input: { cardIds: [card.id], reason: 'Remove' } }],
  ] as const;
  board.record(
    'role',
    { ...role, capabilities: { ...defaultCapabilities, manageWorkflow: false } },
    'user',
    'Revoke board access',
  );
  for (const [action, input] of calls)
    await expect(daemon.service.agentCall(token, action, input)).rejects.toThrow('disabled');
  board.record('role', { ...role, enabled: false }, 'user', 'Pause');
  for (const [action, input] of calls)
    await expect(daemon.service.agentCall(token, action, input)).rejects.toThrow('paused');
  board.record('role', role, 'user', 'Resume');
  daemon.service.controllers.get('board-fixture')!.abort();
  for (const [action, input] of calls)
    await expect(daemon.service.agentCall(token, action, input)).rejects.toThrow('expired');
  expect(board.get<Card>('card', card.id).state).toBe('offer');
});

it('finishes an actual chat successfully after its attached job is deleted', async () => {
  const { daemon, request } = await setup(19577);
  await daemon.service.saveProfile(
    'profile.md',
    '# Fixture Candidate\n\nBuilt fictional interfaces.',
  );
  const card = daemon.service.board.createCard(
    cardInput.parse({ company: 'Fixture', title: 'Engineer' }),
  );
  const { result: run } = await request<Run>('/roles/scout/chat', 'POST', {
    content: 'Remove this fictional job.',
    cardId: card.id,
  });
  const token = [...daemon.service.capabilities.entries()].find(
    ([, capability]) => capability.runId === run.id,
  )![0];
  await daemon.service.agentCall(token, 'delete_job', { reason: 'User requested removal' });
  const snapshot = await finish(request, run.id);
  expect(snapshot.cards).toEqual([]);
  expect(snapshot.runs.find((item) => item.id === run.id)).toMatchObject({
    status: 'completed',
    outputPacketDigest: null,
  });
});

it.each(['bulk_move_jobs', 'bulk_delete_jobs'] as const)(
  '%s reports mixed outcomes in order and continues past busy and missing jobs',
  async (action) => {
    const { daemon, request } = await setup(action === 'bulk_move_jobs' ? 15624 : 15625);
    const board = daemon.service.board;
    const cards = ['First', 'Busy', 'Last'].map((company) =>
      board.createCard(cardInput.parse({ company, title: 'Fixture Engineer' })),
    );
    for (const card of cards)
      board.record('card', { ...card, state: 'rejected' }, 'user', 'Fixture terminal state');
    const busy = cards[1]!;
    board.record(
      'run',
      {
        id: 'busy-job',
        cardId: busy.id,
        roleId: 'writer',
        runtime: 'demo',
        mode: 'workflow',
        status: 'running',
        message: 'Fixture busy run',
        startedAt: '',
        finishedAt: null,
      } satisfies Run,
      'writer',
      'Fixture busy run',
    );
    const token = scopedRun(daemon);
    const missing = randomUUID();
    const ids = [cards[0]!.id, busy.id, missing, cards[2]!.id];
    const { response, result } = await request(
      '/agent',
      'POST',
      {
        action,
        input: {
          cardIds: ids,
          reason: 'Batch board correction',
          ...(action === 'bulk_move_jobs' ? { state: 'lead' } : {}),
        },
      },
      { authorization: `Bearer ${token}` },
    );
    expect(response.status).toBe(200);
    expect(result).toEqual({
      succeeded: 2,
      failed: 2,
      results: [
        { cardId: ids[0], ok: true, ...(action === 'bulk_move_jobs' ? { state: 'lead' } : {}) },
        { cardId: busy.id, ok: false, error: 'Wait for the application’s active run to finish.' },
        { cardId: missing, ok: false, error: 'card not found.' },
        { cardId: ids[3], ok: true, ...(action === 'bulk_move_jobs' ? { state: 'lead' } : {}) },
      ],
    });
    expect(board.get<Card>('card', busy.id).state).toBe('rejected');
    board.rebuild();
    if (action === 'bulk_move_jobs')
      expect(board.list<Card>('card').map((card) => card.state)).toEqual([
        'lead',
        'rejected',
        'lead',
      ]);
    else expect(board.list<Card>('card').map((card) => card.id)).toEqual([busy.id]);
  },
);

it.each(['bulk_move_jobs', 'bulk_delete_jobs'] as const)(
  '%s rolls back an individual job when its saved message fails and continues the batch',
  async (action) => {
    const { daemon } = await setup(action === 'bulk_move_jobs' ? 15626 : 15627);
    const board = daemon.service.board;
    const cards = ['Failed', 'Successful'].map((company) =>
      board.createCard(cardInput.parse({ company, title: 'Fixture Engineer' })),
    );
    const token = scopedRun(daemon);
    const record = board.record.bind(board);
    vi.spyOn(board, 'record').mockImplementation((kind, data, ...args) => {
      if (kind === 'message' && 'cardId' in data && data.cardId === cards[0]!.id)
        throw new Error('Fixture message failure');
      return record(kind, data, ...args);
    });
    const result = await daemon.service.agentCall(token, action, {
      input: {
        cardIds: cards.map((card) => card.id),
        reason: 'Batch correction',
        ...(action === 'bulk_move_jobs' ? { state: 'offer' } : {}),
      },
    });
    expect(result).toMatchObject({
      succeeded: 1,
      failed: 1,
      results: [
        { cardId: cards[0]!.id, ok: false, error: 'Fixture message failure' },
        { cardId: cards[1]!.id, ok: true },
      ],
    });
    expect(board.get<Card>('card', cards[0]!.id)).toEqual(cards[0]);
    expect(board.history(cards[0]!.id)).toHaveLength(1);
    if (action === 'bulk_move_jobs')
      expect(board.get<Card>('card', cards[1]!.id).state).toBe('offer');
    else expect(() => board.get('card', cards[1]!.id)).toThrow('not found');
  },
);

it('validates the whole batch before mutation and accepts the 100-job boundary', async () => {
  const { daemon, request } = await setup(15628);
  const board = daemon.service.board;
  const card = board.createCard(cardInput.parse({ company: 'Fixture', title: 'Engineer' }));
  const token = scopedRun(daemon);
  const before = board.events();
  const invalid = [
    { cardIds: [] },
    { cardIds: Array.from({ length: 101 }, () => randomUUID()) },
    { cardIds: [card.id, card.id] },
    { cardIds: [card.id, 'invalid-id'] },
    { cardIds: [card.id], reason: ' ' },
    { cardIds: [card.id], unexpected: true },
  ];
  for (const action of ['bulk_move_jobs', 'bulk_delete_jobs']) {
    for (const input of invalid) {
      const { response } = await request(
        '/agent',
        'POST',
        {
          action,
          input: {
            reason: 'Invalid batch',
            ...(action === 'bulk_move_jobs' ? { state: 'offer' } : {}),
            ...input,
          },
        },
        { authorization: `Bearer ${token}` },
      );
      expect(response.status).toBe(400);
      expect(board.events()).toEqual(before);
    }
  }
  await expect(
    daemon.service.agentCall(token, 'bulk_move_jobs', {
      input: { cardIds: [card.id], state: 'invalid', reason: 'Invalid state' },
    }),
  ).rejects.toThrow();
  await expect(
    daemon.service.agentCall(token, 'bulk_move_jobs', {
      input: { cardIds: [card.id], reason: 'Missing state' },
    }),
  ).rejects.toThrow();
  expect(board.events()).toEqual(before);
  const cards = Array.from({ length: 100 }, (_, index) =>
    board.createCard(cardInput.parse({ company: `Batch Fixture ${index}`, title: 'Engineer' })),
  );
  const input = { cardIds: cards.map((item) => item.id), reason: 'Maximum bounded batch' };
  expect(
    await daemon.service.agentCall(token, 'bulk_move_jobs', {
      input: { ...input, state: 'offer' },
    }),
  ).toMatchObject({ succeeded: 100, failed: 0 });
  expect(await daemon.service.agentCall(token, 'bulk_delete_jobs', { input })).toMatchObject({
    succeeded: 100,
    failed: 0,
  });
  expect(board.list<Card>('card')).toEqual([card]);
});
