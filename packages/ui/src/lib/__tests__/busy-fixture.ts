import type { Card, ComputerApproval, Run, WorkQueueView } from '@pitchcrew/core';
import {
  browserApproval,
  brief,
  card,
  delivery,
  question,
  queue,
  request,
  roleProposal,
  run,
  signal,
  snapshot,
} from './attention-fixture.ts';

// A busy morning at scale, after the prototype's busy preview (fourteen made-up asks on top of
// the walkthrough's six, 81 made-up leads, 150 jobs): one browser approval, three briefs held by
// queued drafts, four questions, two failures, eight tracking reviews and two crew proposals. Every
// company is fictional.

const names = [
  'Amber',
  'Birch',
  'Cobble',
  'Dawson',
  'Elder',
  'Fable',
  'Granite',
  'Hollow',
  'Ivory',
];
const trades = ['Labs', 'Works', 'Health', 'Systems', 'Studio', 'Bank', 'Rail', 'Cloud', 'Foods'];
const slug = (company: string) => company.toLowerCase().replace(/\W+/g, '-');

/** A job queue holding one request whose first delivery has the given status. */
const held = (
  cardId: string,
  action: 'draft' | 'fit',
  roleId: string,
  status: 'queued' | 'waiting' | 'failed',
  fields: Partial<WorkQueueView> = {},
  runId: string | null = null,
) =>
  queue(`job:${cardId}`, {
    requests: [
      request(`${action}-${cardId}`, {
        boardAction: action,
        content: action === 'fit' ? 'Evaluate fit' : 'Draft application',
        createdAt: '2026-11-17T04:00:00.000Z',
        deliveries: [delivery(roleId, status, runId)],
      }),
    ],
    ...fields,
  });

export const busySnapshot = () => {
  const cards: Card[] = [];
  const add = (company: string, fields: Partial<Card> = {}) => {
    const item = card(slug(company), { company, ...fields });
    cards.push(item);
    return item;
  };
  // Working now: five job runs fill the five slots.
  const working = [
    ['Halcyon', 'reviewer', 'in_review', 'application-review'],
    ['Acme Robotics', 'writer', 'drafting', 'application-draft'],
    ['Lumen Labs', 'scout', 'lead', 'fit'],
    ['Globex', 'writer', 'changes_requested', 'application-draft'],
    ['Initech', 'submitter', 'awaiting_approval', undefined],
  ] as const;
  const runs: Run[] = working.map(([company, roleId, state, purpose], index) => {
    const job = add(company, { state });
    return run(`run-${job.id}`, {
      cardId: job.id,
      roleId,
      purpose,
      threadId: `t-${job.id}`,
      startedAt: `2026-11-18T08:${String(10 + index * 3).padStart(2, '0')}:00.000Z`,
    });
  });
  const approvals: ComputerApproval[] = [
    browserApproval('approval-initech', {
      runId: 'run-initech',
      cardId: 'initech',
      createdAt: '2026-11-18T08:36:00.000Z',
    }),
  ];
  // Briefs whose queued drafts they hold: Waypoint's queue already went on hold, the other two
  // wait for a slot (ready, no reason) and are promoted all the same.
  const queues: WorkQueueView[] = working.map(([company], index) =>
    queue(`job:${slug(company)}`, { state: 'running', order: index, runs: [runs[index]!] }),
  );
  for (const [company, at, blocked] of [
    ['Waypoint', '2026-11-17T21:00:00.000Z', true],
    ['Quill Studio', '2026-11-17T06:10:00.000Z', false],
    ['Harbor Health', '2026-11-17T06:40:00.000Z', false],
  ] as const) {
    const job = add(company, {
      state: 'shortlisted',
      applicationContext: brief({ createdAt: at }),
    });
    queues.push(
      held(
        job.id,
        'draft',
        'writer',
        'queued',
        blocked
          ? {
              state: 'blocked',
              reason: 'Review and confirm this job’s application brief before drafting.',
            }
          : {},
      ),
    );
  }
  const questions = [
    ['Umbra Health', '2026-11-18T08:15:00.000Z'],
    ['Plinth', '2026-11-17T07:20:00.000Z'],
    ['Vantage Rail', '2026-11-17T07:45:00.000Z'],
    ['Copperleaf', '2026-11-17T08:05:00.000Z'],
  ].map(([company, at]) => {
    const job = add(company!, { state: 'drafting' });
    queues.push(
      held(job.id, 'draft', 'writer', 'waiting', { state: 'waiting' }, `run-ask-${job.id}`),
    );
    runs.push(run(`run-ask-${job.id}`, { cardId: job.id, status: 'waiting', startedAt: at }));
    return question(`question-${job.id}`, {
      cardId: job.id,
      runId: `run-ask-${job.id}`,
      threadId: `t-${job.id}`,
      createdAt: at,
    });
  });
  for (const [company, finished] of [
    ['Corvid', '2026-11-18T03:41:00.000Z'],
    ['Keystone', '2026-11-17T05:12:00.000Z'],
  ] as const) {
    const job = add(company, { applicationContext: brief() });
    runs.push(
      run(`run-fit-${job.id}`, {
        cardId: job.id,
        roleId: 'scout',
        status: 'failed',
        purpose: 'fit',
        startedAt: '2026-11-17T01:00:00.000Z',
        finishedAt: finished,
      }),
    );
    queues.push(
      held(
        job.id,
        'fit',
        'scout',
        'failed',
        {
          state: 'paused',
          paused: true,
          pauseKind: 'failed',
          reason: 'Scout stopped before finishing.',
        },
        `run-fit-${job.id}`,
      ),
    );
  }
  const signals = [
    ['Bluefin', '2026-11-18T07:00:00.000Z', 'screening'],
    ['Cinder', '2026-11-16T13:00:00.000Z', 'screening'],
    ['Flint', '2026-11-16T13:00:00.000Z', 'screening'],
    ['Marlow', '2026-11-17T07:00:00.000Z', 'rejected'],
    ['Orbital', '2026-11-17T07:00:00.000Z', 'interviewing'],
    ['Iris', '2026-11-17T07:00:00.000Z', 'interviewing'],
    ['Loom', '2026-11-17T07:00:00.000Z', 'screening'],
    ['Fathom', '2026-11-17T07:00:00.000Z', 'offer'],
  ].map(([company, at, state]) => {
    const job = add(company!, { state: state === 'offer' ? 'interviewing' : 'submitted' });
    return signal(`signal-${job.id}`, {
      company: company!,
      candidateIds: [job.id],
      createdAt: at,
      state: state as Card['state'],
    });
  });
  // 81 made-up leads; the first 60 wait for Scout's fit behind the five busy slots.
  names.forEach((name, i) =>
    trades.forEach((trade, j) => {
      const job = add(`${name} ${trade}`);
      if (i * trades.length + j < 60)
        queues.push(held(job.id, 'fit', 'scout', 'queued', { order: 100 + i * 9 + j }));
    }),
  );
  for (let i = cards.length; i < 150; i++)
    add(`Fictional Co ${i}`, { state: i % 2 ? 'submitted' : 'rejected', fit: 60 });
  return snapshot({
    cards,
    runs,
    computerApprovals: approvals,
    userInputs: questions,
    trackingSignals: signals,
    proposals: [
      roleProposal('proposal-coach', {
        roleId: 'scout',
        sourceRoleId: 'pipeline-coach',
        createdAt: '2026-11-17T22:00:00.000Z',
      }),
      roleProposal('proposal-busy', {
        roleId: 'scout',
        sourceRoleId: 'pipeline-coach',
        createdAt: '2026-11-17T02:00:00.000Z',
      }),
    ],
    queue: { concurrency: 5, active: 5, background: 0, queues },
  });
};
