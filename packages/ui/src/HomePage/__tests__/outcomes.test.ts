import { describe, expect, it } from 'vitest';
import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { attentionItems, type AttentionKind } from '@/lib/attention.ts';
import {
  browserApproval,
  delivery,
  everyKind,
  pendingPacket,
  question,
  queue,
  request,
  run,
  signal,
} from '@/lib/__tests__/attention-fixture.ts';
import { installed } from '@/lib/__tests__/crew-lens-fixture.ts';
import { deskOutcome } from '../outcomes.ts';
import type { DeskCall } from '../types.ts';

const data = everyKind();
const viewOf = (kind: AttentionKind, from: Snapshot = data) => ({
  item: attentionItems(from).find((item) => item.kind === kind)!,
  data: from,
});
const post = (path: string, body: unknown = {}, method = 'POST'): DeskCall => ({
  path,
  method,
  body,
});
const outcome = (kind: AttentionKind, calls: DeskCall[], fresh: Snapshot, from = data) =>
  deskOutcome(viewOf(kind, from), calls, fresh, attentionItems(fresh));
const text = (kind: AttentionKind, calls: DeskCall[], fresh: Snapshot, from = data) =>
  outcome(kind, calls, fresh, from).text;
/** `data` with its queue views replaced: five of five slots busy unless `active` says otherwise. */
const withQueues = (from: Snapshot, queues: WorkQueueView[], active = 5): Snapshot => ({
  ...from,
  queue: { concurrency: 5, active, background: 0, queues },
});
const waitingLine = (count: number) =>
  Array.from({ length: count }, (_, index) => queue(`job:other-${index}`, { state: 'ready' }));

describe('Record words', () => {
  it('says what an approval does, and that a final submission is verified after', () => {
    const decide = (approved: boolean) => [
      post('/computer-approvals/approval-1/decide', { approved }),
    ];
    const saved = (status: 'approved' | 'rejected') => ({
      ...data,
      computerApprovals: [browserApproval('approval-1', { status })],
    });
    expect(text('browser', decide(true), saved('approved'))).toBe(
      'Approved: Click “Submit application” on jobs.example.com. Submitter carries it out; you verify the outcome after.',
    );
    const click = {
      ...data,
      computerApprovals: [
        browserApproval('approval-1', { action: { kind: 'click', selector: '#submit' } }),
      ],
    };
    expect(text('browser', decide(true), saved('approved'), click)).toBe(
      'Approved: Click “Submit application” on jobs.example.com. Submitter carries it out.',
    );
    expect(text('browser', decide(false), saved('rejected'))).toBe(
      'Rejected: nothing was done. Submitter’s run may ask again or end.',
    );
    // A dialog that continues an uncertain submission is a final submission too.
    const continuation = {
      ...data,
      computerApprovals: [
        browserApproval('approval-1', {
          action: {
            kind: 'dialog',
            decision: 'accept',
            submissionAttemptId: '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
          },
        }),
      ],
    };
    expect(text('browser', decide(true), saved('approved'), continuation)).toMatch(
      /Submitter carries it out; you verify the outcome after\.$/,
    );
  });

  /** The continuation the daemon queues for an answer, as `answerUserQuestion` saves it. */
  const continueUmbra = (status: 'queued' | 'running') =>
    request('continue-1', { userInputId: 'question-1', deliveries: [delivery('writer', status)] });
  const answeredOne = (fields: Partial<Snapshot> = {}) =>
    installed({
      ...data,
      userInputs: [
        question('question-1', { status: 'answered', continuationRequestId: 'continue-1' }),
      ],
      ...fields,
    });

  it('quotes an answer by its option labels and says when its own continuation runs', () => {
    const answered = (
      status: 'queued' | 'running',
      state: WorkQueueView['state'],
      before = 0,
      active = 5,
    ) =>
      withQueues(
        answeredOne(),
        [...waitingLine(before), queue('job:umbra', { state, requests: [continueUmbra(status)] })],
        active,
      );
    const answer = (body: unknown) => [post('/user-input/question-1/answer', body)];
    const choice = answer({ selected: ['design'], text: '' });
    expect(text('question', choice, answered('queued', 'ready', 2))).toBe(
      'Answered “Design systems” · Writer continues when a slot frees, 3rd in line',
    );
    expect(text('question', choice, answered('queued', 'ready', 0))).toBe(
      'Answered “Design systems” · Writer continues when a slot frees, next in line',
    );
    expect(text('question', choice, answered('running', 'running'))).toBe(
      'Answered “Design systems” · Writer continues now',
    );
    expect(text('question', choice, answered('queued', 'ready', 0, 4))).toBe(
      'Answered “Design systems” · Writer continues now',
    );
    // With no saved continuation to read, the record claims nothing about it.
    const unread = withQueues(
      { ...data, userInputs: [question('question-1', { status: 'answered' })] },
      [queue('job:umbra', { state: 'waiting' })],
    );
    expect(
      text('question', answer({ selected: [], text: 'Lead with the performance work' }), unread),
    ).toBe('Answered “Lead with the performance work”');
    expect(text('question', [post('/user-input/question-1/cancel')], unread)).toBe(
      'Question cancelled',
    );
  });

  it('never says an answer continues now while another run holds the queue or another question waits', () => {
    // Waypoint: Reviewer runs in the job's queue while Writer waits on two questions. Answering
    // one queues its continuation, which the queue starts only once the other is answered too.
    const review = run('run-review-wp', { cardId: 'umbra', roleId: 'reviewer' });
    const asked = (id: string, roleId = 'writer') =>
      question(id, { roleId, runId: `run-${id}`, question: `Question ${id}?` });
    const mixed = (other: string) =>
      answeredOne({
        runs: [...data.runs, review],
        userInputs: [
          question('question-1', { status: 'answered', continuationRequestId: 'continue-1' }),
          asked('question-2', other),
        ],
        queue: {
          concurrency: 5,
          active: 5,
          background: 0,
          queues: [
            queue('job:umbra', {
              state: 'running',
              runs: [review],
              requests: [continueUmbra('queued')],
            }),
          ],
        },
      });
    const before = { ...data, userInputs: [question('question-1'), asked('question-2')] };
    const choice = [post('/user-input/question-1/answer', { selected: ['design'], text: '' })];
    expect(text('question', choice, mixed('writer'), before)).toBe(
      'Answered “Design systems” · Writer continues after you answer its other question',
    );
    expect(text('question', choice, mixed('scout'), before)).toBe(
      'Answered “Design systems” · Writer continues after you answer Scout’s question',
    );
    // Once no other question waits, it still waits for the run that holds its queue.
    const alone = answeredOne({
      runs: [...data.runs, review],
      queue: {
        concurrency: 5,
        active: 5,
        background: 0,
        queues: [
          queue('job:umbra', {
            state: 'running',
            runs: [review],
            requests: [continueUmbra('queued')],
          }),
        ],
      },
    });
    expect(text('question', choice, alone)).toBe(
      'Answered “Design systems” · Writer continues when Reviewer’s run ends',
    );
    // A queue on hold for another reason holds the continuation too.
    const held = withQueues(answeredOne(), [
      queue('job:umbra', {
        state: 'paused',
        paused: true,
        pauseKind: 'user',
        reason: 'Paused by you.',
        requests: [continueUmbra('queued')],
      }),
    ]);
    expect(text('question', choice, held)).toBe(
      'Answered “Design systems” · Writer’s continuation is on hold',
    );
  });

  it('names no place in line for work its agent cannot start, which no free slot starts', () => {
    // Scout is paused, so the retried fit leaves the waiting line until the user resumes Scout.
    const paused = installed({
      ...data,
      roles: data.roles.map((role) => (role.id === 'scout' ? { ...role, enabled: false } : role)),
    });
    const retried = withQueues(paused, [
      ...waitingLine(1),
      queue('job:corvid', {
        state: 'ready',
        requests: [
          request('fit-corvid', { boardAction: 'fit', deliveries: [delivery('scout', 'queued')] }),
        ],
      }),
    ]);
    const retry = [post('/chat-requests/fit-corvid', { action: 'resume' }, 'PUT')];
    expect(text('failure', retry, retried)).toBe('Retry queued');
  });

  it('says where a retried request waits, and what a skip continues', () => {
    const resumed = (state: WorkQueueView['state'], before = 0, active = 5) =>
      withQueues(data, [...waitingLine(before), queue('job:corvid', { state })], active);
    const retry = [post('/chat-requests/fit-corvid', { action: 'resume' }, 'PUT')];
    expect(text('failure', retry, resumed('ready', 3))).toBe('Retry queued · 4th in line');
    expect(text('failure', retry, resumed('running'))).toBe('Retry running now');
    expect(text('failure', retry, resumed('ready', 0, 4))).toBe('Retry queued · starting now');
    const skip = [
      post('/chat-requests/fit-corvid', { action: 'remove' }, 'PUT'),
      post('/queue/job%3Acorvid', { action: 'resume' }, 'PUT'),
    ];
    expect(text('failure', skip, resumed('ready'))).toBe(
      'Skipped the fit evaluation · the job’s queue continues',
    );
    // Only what completed: before its resume succeeds the queue is not said to continue, and a
    // resume the daemon refused leaves it paused.
    expect(text('failure', skip.slice(0, 1), withQueues(data, []))).toBe(
      'Skipped the fit evaluation',
    );
    const refused = [skip[0]!, { ...skip[1]!, failed: true as const }];
    expect(text('failure', refused, withQueues(data, []))).toBe(
      'Skipped the fit evaluation · the job’s queue is still paused',
    );
    // With nothing stopped left to retry, the queue's own Resume.
    const resume = [post('/queue/job%3Acorvid', { action: 'resume' }, 'PUT')];
    expect(text('failure', resume, resumed('ready', 3))).toBe(
      'Resumed the job’s queue · 4th in line',
    );
    expect(text('failure', resume, resumed('running'))).toBe(
      'Resumed the job’s queue · running now',
    );
    expect(text('failure', resume, resumed('ready', 0, 4))).toBe(
      'Resumed the job’s queue · starting now',
    );
    const followUp = (action: string) => [post('/queue/job%3Acorvid', { action }, 'PUT')];
    expect(text('failure', followUp('retry-follow-up'), resumed('ready'))).toBe(
      'Follow-up retry queued',
    );
    expect(text('failure', followUp('skip-follow-up'), resumed('ready'))).toBe(
      'Follow-up skipped · the queue continues',
    );
  });

  it('records a tracking outcome with moss for a step forward, and says what a rejection keeps', () => {
    const decided = (
      status: 'applied' | 'rejected',
      state: 'screening' | 'rejected' = 'screening',
    ) => ({
      ...data,
      trackingSignals: [signal('signal-1', { status, state, cardId: 'bluefin' })],
    });
    const decision = (approved: boolean) => [
      post('/tracking/evidence/signal-1/decision', { approved }),
    ];
    expect(outcome('tracking', decision(true), decided('applied'))).toEqual({
      text: 'Recorded Screening',
      bead: 'moss',
    });
    expect(outcome('tracking', decision(true), decided('applied', 'rejected'))).toEqual({
      text: 'Recorded Rejected',
      bead: 'primary',
    });
    expect(text('tracking', decision(false), decided('rejected'))).toBe(
      'Update rejected · Bluefin stays Submitted',
    );
  });

  it('says what each packet decision did and did not send', () => {
    const saved = (status: 'rejected' | 'consumed') => ({
      ...data,
      approvals: [pendingPacket('packet-1', 'juniper', { status })],
    });
    expect(
      text('packet', [post('/approvals/packet-1/decide', { approved: false })], saved('rejected')),
    ).toBe('Packet rejected · nothing is exported');
    expect(
      text(
        'packet',
        [post('/approvals/packet-1/complete', { state: 'withdrawn' })],
        saved('consumed'),
      ),
    ).toBe('Marked withdrawn · nothing is sent to Juniper');
    expect(
      text(
        'packet',
        [post('/approvals/packet-1/complete', { state: 'submitted' })],
        saved('consumed'),
      ),
    ).toBe('Recorded Submitted');
    const handoff = [
      post('/approvals/packet-1/decide', { approved: true }),
      post('/approvals/packet-1/submit', { method: 'agent', roleId: 'submitter' }),
    ];
    expect(text('packet', handoff, saved('consumed'))).toBe(
      'Handed to Submitter to prepare · nothing is submitted until you approve the final step',
    );
  });

  it('reads proposals and writing suggestions from their saved status', () => {
    const decide = (path: string, approved: boolean) => [post(path, { approved })];
    const roles = (status: 'applied' | 'rejected') => ({
      ...data,
      proposals: data.proposals.map((proposal) => ({ ...proposal, status })),
    });
    expect(
      text('role-proposal', decide('/proposals/proposal-1/decide', true), roles('applied')),
    ).toBe('Applied · Writer uses it from its next run');
    expect(
      text('role-proposal', decide('/proposals/proposal-1/decide', false), roles('rejected')),
    ).toBe('Declined · Writer’s instructions stay as they are');
    const skills = (status: 'applied' | 'rejected') => ({
      ...data,
      skillProposals: data.skillProposals.map((proposal) => ({ ...proposal, status })),
    });
    const skillPath = '/skill-proposals/skill-proposal-1/decide';
    expect(text('skill-proposal', decide(skillPath, true), skills('applied'))).toBe(
      'Skill added · available in new runs',
    );
    expect(text('skill-proposal', decide(skillPath, false), skills('rejected'))).toBe('Declined');
    const guide = data.quality!.writingGuide;
    const writing = (status: 'applied' | 'rejected'): Snapshot => ({
      ...data,
      quality: {
        ...data.quality!,
        writingGuide: {
          ...guide,
          proposals: guide.proposals.map((proposal) => ({ ...proposal, status })),
        },
      },
    });
    const change = (approved: boolean) => [
      post('/quality', { revision: 3, action: 'proposal_decision', id: 'writing-1', approved }),
    ];
    expect(text('writing-suggestion', change(true), writing('applied'))).toBe(
      'Applied to the writing guide',
    );
    expect(text('writing-suggestion', change(false), writing('rejected'))).toBe('Dismissed');
  });
});
