import { adapters } from '@pitchcrew/adapters';
import { digestPacket } from '@pitchcrew/board';
import {
  cardInput,
  decodeEvent,
  defaultCapabilities,
  type PipelineReview,
  type Role,
  type RoleProposal,
  type Run,
} from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { configRevision } from '../src/crew/pipeline/snapshots.ts';
import { cleanup, finish, resources, setup } from './helpers/daemon.ts';
import { packet, profile } from '../../mcp/test/fixtures/evaluation.ts';

afterEach(async () => {
  for (const resource of resources) resource.daemon.service.controllers.delete('coach-fixture');
  await cleanup();
});
async function fixture(port = 14800) {
  const state = await setup(port);
  const { daemon } = state;
  const role = daemon.service.board.get<Role>('role', 'scout');
  await daemon.service.configureRole(role.id, {
    ...role,
    capabilities: { ...defaultCapabilities, reviewPipeline: true, proposeCrewChanges: true },
  });
  const card = daemon.service.board.createCard(
    cardInput.parse({
      company: 'Fictional Labs',
      title: 'Frontend engineer',
      description: 'x'.repeat(20000),
    }),
  );
  const run: Run = {
    id: 'coach-fixture',
    roleId: role.id,
    cardId: card.id,
    runtime: 'demo',
    status: 'running',
    mode: 'chat',
    threadId: 'crew',
    message: 'Fictional review',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  daemon.service.board.record('run', run, role.id, 'Fictional review run');
  daemon.service.controllers.set(run.id, new AbortController());
  daemon.service.capabilities.set('coach-token', {
    runId: run.id,
    roleId: role.id,
    cardId: card.id,
  });
  const evidence = daemon.service.board.history(card.id)[0].id;
  const input = {
    title: 'Fictional batch review',
    scope: { cardIds: [card.id] },
    criteria: ['Source completeness'],
    seats: daemon.service.board.list<Role>('role').map((role) => ({
      roleId: role.id,
      assessment: 'insufficient_evidence',
      rationale: 'No completed fictional runs yet.',
    })),
    findings: [
      {
        id: 'sources',
        targetRoleId: 'writer',
        criterion: 'Source completeness',
        kind: 'observation',
        finding: 'No packet has been drafted for this lead.',
        evidenceEventIds: [evidence],
        nextRunImprovement: 'Check profile quotation coverage before drafting.',
        measurement: 'Record unsupported claim count in the next review.',
      },
    ],
  };
  const call = (action: string, input: unknown) =>
    daemon.service.agentCall('coach-token', action, { input });
  return { ...state, card, run, input, evidence, call };
}

it('requires explicit cross-application review permissions, scopes before pagination, bounds data and responds to revocation', async () => {
  const { daemon, card, call } = await fixture();
  const second = daemon.service.board.createCard(
    cardInput.parse({ company: 'Other fictional studio', title: 'Engineer' }),
  );
  const first = await call('read_pipeline', { section: 'cards', limit: 1 });
  expect(first.items).toHaveLength(1);
  expect(first.nextCursor).not.toBeNull();
  expect(JSON.stringify(first)).not.toContain('x'.repeat(100));
  const filtered = await call('read_pipeline', {
    section: 'cards',
    scope: { cardIds: [second.id] },
    limit: 1,
  });
  expect(filtered.items).toEqual([expect.objectContaining({ id: second.id })]);
  expect(filtered.nextCursor).toBeNull();
  const empty = await call('read_pipeline', {
    section: 'cards',
    scope: { from: '2099-01-01T00:00:00Z' },
  });
  expect(empty.items).toEqual([]);
  await expect(
    call('read_pipeline', {
      section: 'packet',
      entityId: second.id,
      scope: { cardIds: [card.id] },
    }),
  ).rejects.toThrow('outside');
  await expect(call('read_pipeline', { section: 'cards', limit: 51 })).rejects.toThrow();
  const role = daemon.service.board.get<Role>('role', 'scout');
  daemon.service.board.record(
    'role',
    { ...role, capabilities: { ...role.capabilities!, reviewPipeline: false } },
    'user',
    'Fictional revocation',
  );
  await expect(call('read_pipeline', { section: 'cards' })).rejects.toThrow('not enabled');
});

it('persists criteria, evidence snapshots, distinct hypotheses and measurable follow-ups with notifications before adoption', async () => {
  const { daemon, input, evidence, call, request } = await fixture(14801);
  await expect(
    call('save_pipeline_review', {
      ...input,
      findings: [{ ...input.findings[0], evidenceEventIds: [999999] }],
    }),
  ).rejects.toThrow('does not exist');
  const { review } = (await call('save_pipeline_review', input)) as { review: PipelineReview };
  expect(review.evidence).toEqual([expect.objectContaining({ eventId: evidence, kind: 'card' })]);
  const events = daemon.service.board.events(100).reverse();
  expect(events.findIndex((event) => event.entityId === review.noticeMessageId)).toBeLessThan(
    events.findIndex((event) => event.entityId === review.id),
  );
  expect(daemon.service.board.get('message', review.noticeMessageId)).toMatchObject({
    notification: 'attention',
    from: 'scout',
    to: 'user',
  });
  expect(daemon.service.board.get<Role>('role', 'writer').instructions).not.toContain(
    'before drafting',
  );
  await expect(
    call('update_pipeline_review', {
      reviewId: review.id,
      findingId: 'sources',
      status: 'resolved',
      result: '',
      metrics: [],
      evidenceEventIds: [],
    }),
  ).rejects.toThrow('require');
  const result = await request(`/pipeline-reviews/${review.id}/followup`, 'POST', {
    findingId: 'sources',
    status: 'evaluating',
    result: 'Waiting for the next fictional draft.',
    metrics: [{ name: 'Unsupported claims', value: 0, unit: 'claims' }],
    evidenceEventIds: [evidence],
  });
  expect(result.response.status).toBe(200);
  daemon.service.board.rebuild();
  expect(
    daemon.service.board.get<PipelineReview>('pipeline_review', review.id).followups[0],
  ).toMatchObject({ status: 'evaluating', metrics: [{ value: 0 }] });
  const second = daemon.service.board.createCard(
    cardInput.parse({ company: 'Outside review', title: 'Engineer' }),
  );
  await expect(
    call('save_pipeline_review', {
      ...input,
      findings: [
        {
          ...input.findings[0],
          kind: 'hypothesis',
          evidenceEventIds: [daemon.service.board.history(second.id)[0].id],
        },
      ],
    }),
  ).rejects.toThrow('outside');
});

it('binds targeted proposals to reviewed target revisions and checks source authority, target busy state and notice attribution', async () => {
  const { daemon, input, call, request } = await fixture(14802);
  const { review } = (await call('save_pipeline_review', input)) as { review: PipelineReview };
  const target = daemon.service.board.get<Role>('role', 'writer');
  const proposed = {
    targetRoleId: target.id,
    targetRevision: configRevision(target),
    pipelineReviewId: review.id,
    findingId: 'sources',
    reason: 'Use the evidence checklist next run.',
    changes: { instructions: target.instructions + '\nCheck quotation coverage.' },
  };
  const { proposal } = (await call('propose_crew_changes', proposed)) as { proposal: RoleProposal };
  expect(proposal).toMatchObject({
    roleId: 'writer',
    sourceRoleId: 'scout',
    status: 'pending',
    beforeRole: target,
  });
  expect(daemon.service.board.get<Role>('role', 'writer')).toEqual(target);
  await daemon.service.configureRole(target.id, { ...target, model: 'Changed by user' });
  const stale = await request(`/proposals/${proposal.id}/decide`, 'POST', { approved: true });
  expect(stale.response.status).toBe(400);
  expect(stale.result).toMatchObject({ error: expect.stringContaining('changed') });
  expect(daemon.service.board.get<Role>('role', 'writer').model).toBe('Changed by user');
  const fresh = daemon.service.board.get<Role>('role', 'writer');
  const { proposal: next } = (await call('propose_crew_changes', {
    ...proposed,
    targetRevision: configRevision(fresh),
  })) as { proposal: RoleProposal };
  const source = daemon.service.board.get<Role>('role', 'scout');
  daemon.service.board.record(
    'role',
    { ...source, capabilities: { ...source.capabilities!, proposeCrewChanges: false } },
    'user',
    'Revoked fictional source permission',
  );
  await expect(daemon.service.decideProposal(next.id, true)).rejects.toThrow('no longer');
  daemon.service.board.record('role', source, 'user', 'Restore fictional permission');
  const busy: Run = {
    id: 'target-busy',
    roleId: 'writer',
    cardId: null,
    runtime: 'demo',
    status: 'running',
    startedAt: '',
    finishedAt: null,
    message: 'Busy fixture',
  };
  daemon.service.board.record('run', busy, 'user', 'Fictional busy target');
  await expect(daemon.service.decideProposal(next.id, true)).rejects.toThrow('active run');
  daemon.service.board.record(
    'run',
    { ...busy, status: 'completed' },
    'user',
    'Finished fictional target',
  );
  const applied = await daemon.service.decideProposal(next.id, true);
  expect(applied.status).toBe('applied');
  expect(daemon.service.board.get<Role>('role', 'writer').instructions).toBe(
    proposed.changes.instructions,
  );
  await expect(daemon.service.decideProposal(next.id, true)).rejects.toThrow('already');
});

it('records immutable actual run configs and packet digests while future skill edits affect future runs', async () => {
  const { daemon, request } = await setup(14803);
  for (const file of profile) await daemon.service.saveProfile(file.name, file.content);
  const skill = daemon.service.saveSkill({
    name: 'Fictional coverage',
    description: '',
    content: 'Original check',
    scope: 'roles',
    roleIds: ['writer'],
  });
  const card = daemon.service.board.createCard(
    cardInput.parse({ company: 'Fixture Workshop', title: 'Engineer' }),
  );
  daemon.service.board.move(card.id, 'shortlisted', 'user');
  let complete!: (result: { role: 'writer'; packet: typeof packet }) => void;
  const adapter = vi.spyOn(adapters.demo, 'run').mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const run = await daemon.service.startRun(card.id, 'writer');
  expect(run.configuration?.skills[0].content).toBe('Original check');
  daemon.service.saveSkill(
    {
      name: skill.name,
      description: skill.description,
      scope: skill.scope,
      roleIds: skill.roleIds,
      content: 'New future check',
    },
    skill.id,
  );
  complete({ role: 'writer', packet });
  const snapshot = await finish(request, run.id);
  expect(adapter.mock.calls[0][0].skills![0].content).toBe('Original check');
  const saved = snapshot.runs.find((item) => item.id === run.id)!;
  expect(saved.configuration?.skills[0].content).toBe('Original check');
  expect(saved.configuration?.role.runtime).toBe('demo');
  expect(saved.inputPacketDigest).toBeNull();
  expect(saved.outputPacketDigest).toBe(digestPacket(card.id, packet));
  const role = daemon.service.board.get<Role>('role', 'writer');
  await daemon.service.configureRole(role.id, { ...role, instructions: 'Future-only user edit' });
  expect(daemon.service.board.get<Run>('run', run.id).configuration?.role.instructions).toBe(
    role.instructions,
  );
});

it('retains old event decoders and replays version nine review/config records', async () => {
  const { daemon, input, call } = await fixture(14804);
  for (const version of [1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(
      decodeEvent(JSON.stringify({ version, kind: 'role', data: {}, entityId: 'fictional' }))
        .version,
    ).toBe(version);
  const { review } = (await call('save_pipeline_review', input)) as { review: PipelineReview };
  expect(daemon.service.board.history(review.id)[0].version).toBe(10);
  daemon.service.board.rebuild();
  expect(daemon.service.board.get<PipelineReview>('pipeline_review', review.id).title).toBe(
    input.title,
  );
});

it('rejects finalized or missing-controller runs and requires coverage of every seat', async () => {
  const { daemon, run, input, call } = await fixture(14806);
  await expect(
    call('save_pipeline_review', { ...input, seats: input.seats.slice(0, 1) }),
  ).rejects.toThrow('every current crew seat');
  daemon.service.controllers.delete(run.id);
  await expect(call('save_pipeline_review', input)).rejects.toThrow('expired');
  daemon.service.controllers.set(run.id, new AbortController());
  daemon.service.board.record('run', { ...run, status: 'completed' }, 'user', 'Fixture completed');
  await expect(call('read_pipeline', { section: 'cards' })).rejects.toThrow('completed');
});

it('accepts sibling seat evidence without exposing raw email/profile/browser payloads or global scans in card-scoped reviews', async () => {
  const { daemon, input, call, card } = await fixture(14807);
  const board = daemon.service.board;
  const insert = (kind: string, data: Record<string, unknown>) => {
    const createdAt = new Date().toISOString();
    const event = {
      id: 0,
      version: 9,
      kind,
      entityId: String(data.id),
      actor: 'scout',
      message: 'Fictional seat evidence',
      createdAt,
      data,
    };
    return Number(
      board.db.prepare('INSERT INTO events(json) VALUES (?)').run(JSON.stringify(event))
        .lastInsertRowid,
    );
  };
  const signalId = insert('tracking_signal', {
    id: 'signal-fixture',
    cardId: null,
    candidateIds: [card.id],
    roleId: 'scout',
    status: 'pending',
    state: 'screening',
    sourceText: 'Fictional private email source body',
  });
  const scanId = insert('tracking_scan', {
    id: 'scan-fixture',
    roleId: 'scout',
    complete: false,
    account: 'fictional@example.invalid',
    query: 'Fictional private query',
  });
  const formId = insert('form_assessment', {
    id: 'form-fixture',
    cardId: card.id,
    roleId: 'scout',
    runId: 'fictional',
    page: { text: 'Fictional private page body' },
  });
  const receiptId = insert('submission_attempt', {
    id: 'receipt-fixture',
    cardId: card.id,
    roleId: 'scout',
    status: 'confirmed',
    evidence: 'Fictional private receipt text',
  });
  const profileId = insert('profile_proposal', {
    id: 'profile-fixture',
    roleId: 'scout',
    runId: 'fictional',
    status: 'pending',
    documents: [{ content: 'Fictional private profile body' }],
  });
  const scoped = await call('read_pipeline', {
    section: 'events',
    scope: { cardIds: [card.id] },
    limit: 50,
  });
  const ids = (scoped.items as { id: number }[]).map((event) => event.id);
  expect(ids).toEqual(expect.arrayContaining([signalId, formId, receiptId]));
  expect(ids).not.toContain(scanId);
  expect(ids).not.toContain(profileId);
  expect(JSON.stringify(scoped)).not.toContain('Fictional private');
  const review = await call('save_pipeline_review', {
    ...input,
    findings: [{ ...input.findings[0], evidenceEventIds: [signalId, formId, receiptId] }],
  });
  expect((review.review as PipelineReview).evidence).toHaveLength(3);
  await expect(
    call('save_pipeline_review', {
      ...input,
      findings: [{ ...input.findings[0], evidenceEventIds: [scanId] }],
    }),
  ).rejects.toThrow('outside');
});
