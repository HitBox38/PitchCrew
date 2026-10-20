import {
  cardInput,
  defaultCapabilities,
  type Card,
  type Role,
  type Run,
  type SubmissionAttempt,
} from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import { cleanup, resources, setup } from './helpers/daemon.ts';

const context = async () => {
  const { daemon, request } = await setup(15633);
  const service = daemon.service;
  const card = service.board.createCard(
    cardInput.parse({ company: 'Wrong Fixture', title: 'Engineer', salary: 'Saved salary' }),
  );
  const run: Run = {
    id: runId,
    cardId: card.id,
    roleId: 'scout',
    runtime: 'demo',
    mode: 'chat',
    status: 'running',
    message: 'Correct the company',
    startedAt: card.createdAt,
    finishedAt: null,
  };
  service.board.record('run', run, 'scout', 'Fixture');
  service.controllers.set(runId, new AbortController());
  service.capabilities.set(token, { runId, roleId: 'scout', cardId: card.id });
  const call = (input: unknown) => service.agentCall(token, 'update_job', { input });
  return { service, card, run, call, request };
};

const runId = 'details-fixture';
const token = 'details-token';
afterEach(async () => {
  for (const { daemon } of resources) daemon.service.controllers.delete(runId);
  await cleanup();
});

it('corrects the attached company through the agent HTTP gateway without refetching the posting', async () => {
  const { service, card, request } = await context();
  const { response, result } = await request(
    '/agent',
    'POST',
    {
      action: 'update_job',
      input: { changes: { company: 'Correct Fixture' }, reason: 'User corrected the employer' },
    },
    { authorization: `Bearer ${token}` },
  );
  expect(response.status).toBe(200);
  expect(result).toMatchObject({
    card: { id: card.id, company: 'Correct Fixture', title: card.title, salary: card.salary },
  });
  expect(service.board.history(card.id)[0]).toMatchObject({ actor: 'scout' });
  const saved = service.board.get<Card>('card', card.id);
  service.board.rebuild();
  expect(service.board.get<Card>('card', card.id)).toEqual(saved);
});

it('edits an explicit job from an unattached chat and refuses a different attached job', async () => {
  const { service, card, call } = await context();
  const other = service.board.createCard(
    cardInput.parse({ company: 'Other Fixture', title: 'Engineer' }),
  );
  const input = {
    cardId: other.id,
    changes: { company: 'Correct Fixture' },
    reason: 'User correction',
  };
  await expect(call(input)).rejects.toThrow('scoped to the attached job');
  expect(service.board.get<Card>('card', other.id)).toEqual(other);
  service.capabilities.set(token, { runId, roleId: 'scout', cardId: null });
  await expect(call({ changes: input.changes, reason: input.reason })).rejects.toThrow(
    'Choose a job',
  );
  expect(await call(input)).toMatchObject({ card: { id: other.id, company: 'Correct Fixture' } });
  expect(service.board.get<Card>('card', card.id)).toEqual(card);
});

it.each(['workflow', 'chat', 'owner', 'uncertain', 'deleted'] as const)(
  'rejects a %s job without mutation',
  async (kind) => {
    const { service, card, run, call } = await context();
    if (kind === 'workflow' || kind === 'chat')
      service.board.record('run', { ...run, id: 'busy', mode: kind }, 'writer', 'Busy job');
    if (kind === 'owner')
      service.board.record('card', { ...card, owner: 'writer' }, 'writer', 'Owned job');
    if (kind === 'deleted')
      service.board.record('card', { ...card, deletedAt: card.createdAt }, 'user', 'Deleted job');
    if (kind === 'uncertain')
      service.board.record(
        'submission_attempt',
        {
          id: 'uncertain',
          cardId: card.id,
          status: 'uncertain',
        } as SubmissionAttempt,
        'user',
        'Uncertain submission',
      );
    const events = service.board.events();
    await expect(
      call({ changes: { company: 'Correct Fixture' }, reason: 'User correction' }),
    ).rejects.toThrow();
    expect(service.board.events()).toEqual(events);
  },
);

it.each(['permission', 'paused', 'cancelled', 'finished', 'isolated'] as const)(
  'rechecks %s execution access',
  async (kind) => {
    const { service, run, call } = await context();
    const role = service.board.get<Role>('role', 'scout');
    if (kind === 'permission')
      service.board.record(
        'role',
        { ...role, capabilities: { ...defaultCapabilities, manageWorkflow: false } },
        'user',
        'Revoked',
      );
    if (kind === 'paused')
      service.board.record('role', { ...role, enabled: false }, 'user', 'Paused');
    if (kind === 'cancelled') service.controllers.get(runId)!.abort();
    if (kind === 'finished')
      service.board.record('run', { ...run, status: 'completed' }, 'scout', 'Finished');
    if (kind === 'isolated')
      service.board.record('run', { ...run, purpose: 'application-draft' }, 'scout', 'Isolated');
    const events = service.board.events();
    await expect(
      call({ changes: { company: 'Correct Fixture' }, reason: 'User correction' }),
    ).rejects.toThrow();
    expect(service.board.events()).toEqual(events);
  },
);

it('rejects invalid fields and empty corrections before mutation', async () => {
  const { service, call } = await context();
  const events = service.board.events();
  for (const changes of [
    {},
    { company: ' ' },
    { company: 'x'.repeat(101) },
    { state: 'submitted' },
    { applicationContext: {} },
    { description: 'Unreviewed text' },
    { weight: 2 },
    { company: 'Correct Fixture', packet: {} },
  ])
    await expect(call({ changes, reason: 'User correction' })).rejects.toThrow();
  await expect(call({ changes: { company: 'Correct Fixture' }, reason: ' ' })).rejects.toThrow();
  await expect(
    call({ cardId: 'invalid', changes: { company: 'Correct Fixture' }, reason: 'User correction' }),
  ).rejects.toThrow();
  expect(service.board.events()).toEqual(events);
});
