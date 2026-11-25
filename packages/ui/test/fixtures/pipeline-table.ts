import { randomUUID } from 'node:crypto';
import type { Card, ChatRequest, Run, WorkQueue } from '@pitchcrew/core';
import { jobSourceRevision, saveApplicationContext } from '../../../board/src/index.ts';
import type { CrewService } from '../../../orchestrator/src/service.ts';

const extracted = {
  brief: {
    companyContext: 'A fictional employer.',
    responsibilities: ['Build accessible interfaces.'],
    qualifications: ['React and TypeScript.'],
    constraints: [],
  },
  requirements: [],
  flagged: [],
};

export type PipelineTableFixture = Awaited<ReturnType<typeof seedPipelineTable>>;

/** Saves an extracted brief on a job that has none, so Evaluate fit can send it. */
export const giveBrief = (service: CrewService, cardId: string) => {
  const card = service.board.get<Card>('card', cardId);
  return saveApplicationContext(
    service.board,
    card.id,
    jobSourceRevision(card),
    null,
    extracted,
    false,
  );
};

/**
 * Pipeline's table cast, recorded through the board while the daemon runs. One work slot
 * (concurrency 1), held by Halcyon's running Reviewer, so nothing queued here ever starts. Then
 * nineteen leads: ten with extracted briefs and no fit, three without briefs, Northwind and
 * Kestrel AI whose fits already wait for the slot (1st and 2nd in line), Corvid with a brief whose
 * job queue is paused as failed with its failed fit (no run), and three scored. Not scored lists
 * sixteen of them. Fictional; returns every id.
 */
export const seedPipelineTable = async (service: CrewService) => {
  const board = service.board;
  const now = Date.now();
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
  service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  await service.saveProfile(
    'profile.md',
    '# Example Candidate\n\n- Built React interfaces for fictional teams.\n',
  );
  board.record('queue_settings', { id: 'workspace', concurrency: 1 }, 'user', 'Fixture capacity');

  const job = (company: string, fields: Partial<Card> = {}) => {
    const card = service.createCard({
      company,
      title: 'Frontend Engineer',
      url: `https://example.com/${company.toLowerCase().replace(/\W+/g, '-')}`,
      description: 'A fictional job.',
    });
    return Object.keys(fields).length
      ? (board.record('card', { ...card, ...fields }, 'user', 'Fixture job').data as Card)
      : card;
  };
  const brief = (card: Card) =>
    saveApplicationContext(board, card.id, jobSourceRevision(card), null, extracted, false);
  const lane = (card: Card, roleId: string, extra: Partial<WorkQueue> = {}) => {
    const thread = service.createConversation({
      title: `${card.company}: Application work`,
      participants: [roleId],
      cardId: card.id,
    });
    const queue: WorkQueue = {
      id: `job:${card.id}`,
      cardId: card.id,
      threadId: thread.id,
      order: now,
      paused: false,
      reason: '',
      updatedAt: at(1),
      ...extra,
    };
    board.record('work_queue', queue, 'system', 'Fixture queue');
    return thread.id;
  };

  // The one slot: Halcyon's review, recorded before anything is queued.
  const halcyon = job('Halcyon', { state: 'in_review' });
  const review: Run = {
    id: randomUUID(),
    cardId: halcyon.id,
    threadId: lane(halcyon, 'reviewer'),
    roleId: 'reviewer',
    runtime: 'demo',
    status: 'running',
    mode: 'workflow',
    purpose: 'application-review',
    message: 'Checking claims against your profile',
    startedAt: at(12),
    finishedAt: null,
  };
  board.record('run', review, 'reviewer', review.message);
  const active = service.queue().active;
  if (active !== 1) throw new Error(`The table fixture needs its one slot busy, not ${active}.`);

  const briefs = [
    'Alder Labs',
    'Basalt Works',
    'Cedar Health',
    'Dune Systems',
    'Ember Studio',
    'Fjord Bank',
    'Garnet Rail',
    'Heron Cloud',
    'Indigo Foods',
    'Juniper Labs',
  ].map((company) => brief(job(company)));
  const bare = ['Kite Works', 'Larch Works', 'Moss Works'].map((company) => job(company));
  const [northwind, kestrel] = ['Northwind', 'Kestrel AI'].map((company) => brief(job(company)));
  const fits = [northwind!, kestrel!].map((card) =>
    service.queueBoardAction({ cardId: card.id, action: 'fit' }),
  );
  // Corvid: Scout's fit stopped before it ran and paused its job queue as failed.
  const corvid = brief(job('Corvid'));
  const corvidThread = lane(corvid, 'scout', {
    paused: true,
    pauseKind: 'failed',
    reason: 'Scout’s fit evaluation stopped before finishing. Retry or skip this request.',
  });
  const failedMessage = randomUUID();
  service.addMessage(corvidThread, 'user', 'scout', 'Evaluate fit', corvid.id, null, failedMessage);
  const failed: ChatRequest = {
    id: randomUUID(),
    threadId: corvidThread,
    messageId: failedMessage,
    content: 'Evaluate fit',
    attachments: [],
    boardAction: 'fit',
    mode: 'workflow',
    createdAt: at(40),
    order: now + 1,
    deliveries: [
      { roleId: 'scout', status: 'failed', runId: null, error: 'Scout stopped before finishing.' },
    ],
  };
  board.record('chat_request', failed, 'system', 'Fixture failed action');
  const scored = ['Opal Co', 'Pine Co', 'Quartz Co'].map((company, index) =>
    job(company, { fit: 88 - index * 7 }),
  );

  return {
    halcyon: halcyon.id,
    briefs: briefs.map((card) => card.id),
    bare: bare.map((card) => card.id),
    northwind: northwind!.id,
    kestrel: kestrel!.id,
    corvid: corvid.id,
    scored: scored.map((card) => card.id),
    companies: Object.fromEntries(
      [halcyon, ...briefs, ...bare, northwind!, kestrel!, corvid, ...scored].map((card) => [
        card.id,
        card.company,
      ]),
    ),
    fitRequestIds: fits.map((request) => request.id),
    failedRequestId: failed.id,
  };
};
