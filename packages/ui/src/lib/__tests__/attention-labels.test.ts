import { describe, expect, it } from 'vitest';
import type { Snapshot } from '@pitchcrew/core';
import { roleProposalSummary } from '@/ChatWork/summary.ts';
import { attentionItems, type AttentionItem } from '../attention.ts';
import {
  attentionAsk,
  attentionKindLabel,
  attentionPhrase,
  attentionSubject,
} from '../attention-labels.ts';
import {
  ago,
  brief,
  browserApproval,
  card,
  confirmed,
  delivery,
  everyKind,
  everyKindRemote,
  pendingPacket,
  queue,
  request,
  roleProposal,
  roles,
  run,
  signal,
  snapshot,
  task,
} from './attention-fixture.ts';

const words = (data: Snapshot, remoteRequests = everyKindRemote) =>
  Object.fromEntries(
    attentionItems(data, { remoteRequests }).map((item) => [
      item.key,
      [
        attentionSubject(item, data),
        attentionKindLabel(item, data),
        attentionAsk(item, data),
        attentionPhrase(item, data),
      ],
    ]),
  );
const only = (data: Snapshot): [AttentionItem, Snapshot] => [attentionItems(data)[0]!, data];

describe('attention words', () => {
  it('names every kind’s subject, kind, ask and short phrase', () => {
    const writer = roles.find((role) => role.id === 'writer')!;
    expect(words(everyKind())).toEqual({
      'connection:remote-1': [
        '“Fictional Desktop”',
        'Connection request',
        '“Fictional Desktop” wants to connect',
        'wants to connect',
      ],
      'browser:approval-1': [
        'Initech',
        'Browser action approval',
        'Click “Submit application” on jobs.example.com',
        'waiting for your OK',
      ],
      'profile-recovery:profile-2': [
        'Profile',
        'Profile update needs recovery',
        'Approved update needs recovery',
        'needs recovery',
      ],
      'failure:job:corvid': [
        'Corvid',
        'Failed request',
        'Scout’s fit evaluation stopped before finishing',
        'failed',
      ],
      'verify:attempt-1': [
        'Fathom',
        'Submission to verify',
        'Did the Fathom application go through?',
        'verify the submission',
      ],
      'blocked:conversation:t-prep': [
        'Interview prep',
        'On hold',
        'Install the assigned runtime in Settings.',
        'on hold',
      ],
      'question:question-1': [
        'Umbra Health',
        'Question from Writer',
        'Which project should lead the cover letter?',
        'waiting for your answer',
      ],
      'brief:quill': [
        'Quill Studio',
        'Job brief to confirm',
        'Check the brief before drafting',
        'Confirm the job brief first',
      ],
      'packet:packet-1': [
        'Juniper',
        'Packet to approve',
        'Approve the Juniper packet?',
        'approve the packet',
      ],
      'export:halyard': [
        'Halyard',
        'Reviewed packet to export',
        'Reviewer agreed. Choose formats and request export approval',
        'request export approval',
      ],
      'tracking:signal-1': [
        'Bluefin',
        'Tracking review',
        'Engineer → Screening · uncertain match',
        'proposes Screening',
      ],
      'instruction-update:scout': [
        'Scout’s instructions',
        'New default instructions',
        'Scout has new default instructions',
        'has new default instructions',
      ],
      'writing-suggestion:writing-1': [
        'Writing guide',
        'Writing suggestion from Writer',
        'Prefer one concrete result per paragraph over a list of duties.',
        'proposes a change',
      ],
      'profile-proposal:profile-1': [
        'Profile',
        'Profile update to review',
        '2 notes changed on GitHub',
        'proposes a change',
      ],
      'role-proposal:proposal-1': [
        'Writer’s instructions',
        'Proposal from Writer',
        roleProposalSummary(roleProposal('proposal-1'), writer),
        'proposes a change',
      ],
      'skill-proposal:skill-proposal-1': [
        'Cover letter openings',
        'Skill suggestion from Reviewer',
        'Adds “Cover letter openings” for Writer and Reviewer.',
        'proposes a change',
      ],
      'skill-update:skill-1': [
        'Cover letter openings',
        'Skill update',
        'Cover letter openings has an upstream update',
        'has an upstream update',
      ],
    });
    expect(roleProposalSummary(roleProposal('proposal-1'), writer)).toContain('paragraph');
  });

  it('words the brief by the step it is on', () => {
    const ask = (fields: Parameters<typeof card>[1]) =>
      attentionAsk(
        ...only(snapshot({ cards: [card('quill', { state: 'shortlisted', ...fields })] })),
      );
    expect(ask({ url: 'https://quill.example/apply', applicationContext: brief() })).toBe(
      'Check the application form first',
    );
    expect(ask({ applicationContext: brief() })).toBe('Check the brief before drafting');
    expect(
      ask({
        applicationContext: confirmed({
          requirements: [
            { id: 'why', question: 'Why?', required: true, personal: true, answer: '' },
          ],
        }),
      }),
    ).toBe('Add your answers to the brief');
  });

  it('words interrupted work and failed follow-ups', () => {
    const interrupted = snapshot({
      cards: [card('corvid', { company: 'Corvid' })],
      queue: {
        concurrency: 5,
        active: 0,
        background: 0,
        queues: [
          queue('job:corvid', {
            paused: true,
            pauseKind: 'interrupted',
            state: 'paused',
            requests: [
              request('fit', {
                boardAction: 'fit',
                deliveries: [delivery('scout', 'paused', 'run-1')],
              }),
            ],
          }),
        ],
      },
    });
    const [item] = only(interrupted);
    expect([
      attentionKindLabel(item, interrupted),
      attentionAsk(item, interrupted),
      attentionPhrase(item, interrupted),
    ]).toEqual([
      'Interrupted request',
      'Scout’s fit evaluation was interrupted when Pitchcrew stopped',
      'interrupted',
    ]);
    const followUp = snapshot({
      runs: [run('run-parent', { roleId: 'reviewer', status: 'completed' })],
      conversations: [
        { id: 't-1', title: 'Globex: Application work' } as NonNullable<
          Snapshot['conversations']
        >[number],
      ],
      queue: {
        concurrency: 5,
        active: 0,
        background: 0,
        queues: [
          queue('conversation:t-1', {
            threadId: 't-1',
            paused: true,
            pauseKind: 'failed',
            state: 'paused',
            tasks: [task('task-1', { status: 'failed', roleId: 'writer' })],
          }),
        ],
      },
    });
    expect(words(followUp, [])['failure:conversation:t-1']).toEqual([
      'Globex: Application work',
      'Failed request',
      'Writer’s follow-up for Reviewer stopped before finishing',
      'failed',
    ]);
    // A chat request with no board action is the agent's reply to the user's words.
    const chat = snapshot({
      queue: {
        concurrency: 5,
        active: 0,
        background: 0,
        queues: [
          queue('conversation:t-2', {
            threadId: 't-2',
            title: 'Offer comparison',
            paused: true,
            pauseKind: 'failed',
            state: 'paused',
            requests: [
              request('ask', {
                content: 'Compare   the two\noffers side by side',
                deliveries: [delivery('writer', 'failed')],
              }),
            ],
          }),
          // What answering a question queued: its text is the agent's own instruction.
          queue('conversation:t-3', {
            threadId: 't-3',
            title: 'Interview prep',
            paused: true,
            pauseKind: 'failed',
            state: 'paused',
            requests: [
              request('continue', {
                userInputId: 'question-1',
                content: 'Continue your interrupted task after the user answered your question.',
                deliveries: [delivery('writer', 'failed')],
              }),
            ],
          }),
        ],
      },
    });
    expect(words(chat, [])['failure:conversation:t-2']?.slice(0, 3)).toEqual([
      'Offer comparison',
      'Failed request',
      'Writer’s reply to “Compare the two offers side by side” stopped before finishing',
    ]);
    expect(words(chat, [])['failure:conversation:t-3']?.[2]).toBe(
      'Writer’s continuation after your answer stopped before finishing',
    );
  });

  it('never says queued work stopped once the stopped request is gone and the queue stays paused', () => {
    // A Skip removed the failed fit but its queue resume failed; then another fit was queued.
    const stuck = snapshot({
      cards: [card('corvid', { company: 'Corvid' })],
      queue: {
        concurrency: 5,
        active: 5,
        background: 0,
        queues: [
          queue('job:corvid', {
            paused: true,
            pauseKind: 'failed',
            state: 'paused',
            reason: 'Scout’s fit evaluation stopped before finishing. Retry or skip this request.',
            requests: [
              request('fit-again', {
                boardAction: 'fit',
                deliveries: [delivery('scout', 'queued')],
              }),
            ],
          }),
        ],
      },
    });
    expect(words(stuck, [])['failure:job:corvid']?.slice(1, 3)).toEqual([
      'Failed request',
      'Paused until you resume the queue',
    ]);
  });

  it('words each packet stage', () => {
    const stage = (fields: Parameters<typeof pendingPacket>[2]) => {
      const data = snapshot({
        cards: [card('juniper', { company: 'Juniper', state: 'awaiting_approval' })],
        approvals: [pendingPacket('p', 'juniper', fields)],
      });
      const [item] = only(data);
      return [
        attentionKindLabel(item, data),
        attentionAsk(item, data),
        attentionPhrase(item, data),
      ];
    };
    expect(stage({ status: 'approved' })).toEqual([
      'Choose how to apply',
      'Choose how to apply to Juniper',
      'choose how to apply',
    ]);
    expect(
      stage({
        status: 'consumed',
        submission: { method: 'manual' },
        exportDirectory: '/fictional',
      }),
    ).toEqual(['Ready to apply', 'Apply to Juniper, then record it', 'apply, then record it']);
    expect(
      stage({ status: 'consumed', submission: { method: 'agent', requestId: 'gone' } }),
    ).toEqual(['Preparation stopped', 'Check on the Juniper application', 'check the preparation']);
  });

  it('adds the page’s host only where the summary leaves it out', () => {
    const ask = (fields: Parameters<typeof browserApproval>[1]) => {
      const data = { ...everyKind(), computerApprovals: [browserApproval('a', fields)] };
      return attentionAsk(
        attentionItems(data).find((item) => item.kind === 'browser')!,
        data,
      );
    };
    expect(ask({ page: { ...browserApproval('x').page, controls: [] } })).toBe(
      'Click an element on jobs.example.com',
    );
    expect(ask({ action: { kind: 'navigate', url: 'https://careers.example.org/jobs' } })).toBe(
      'Open careers.example.org/jobs',
    );
  });

  it('drops “uncertain match” once the Tracker bound the email to a job', () => {
    const data = snapshot({
      cards: [card('bluefin', { company: 'Bluefin', state: 'submitted' })],
      trackingSignals: [signal('s', { cardId: 'bluefin', state: 'interviewing' })],
    });
    expect(attentionAsk(...only(data))).toBe('Engineer → Interviewing');
    // With several candidates the subject comes from the email.
    const loose = snapshot({ trackingSignals: [signal('s', { candidateIds: ['a', 'b'] })] });
    expect(attentionSubject(...only(loose))).toBe('Bluefin');
  });

  it('falls back to the conversation, then the queue, for job-free asks', () => {
    const subject = (fields: Partial<Snapshot>) =>
      attentionSubject(
        ...only(
          snapshot({
            computerApprovals: [browserApproval('a', { cardId: null, runId: 'run-free' })],
            runs: [run('run-free', { roleId: 'scout', threadId: 'scout', startedAt: ago(3) })],
            ...fields,
          }),
        ),
      );
    const lane = queue('conversation:scout', {
      threadId: 'scout',
      title: 'Offer comparison',
      state: 'running',
    });
    const queued = { concurrency: 5, active: 1, background: 0, queues: [lane] };
    const conversations = [
      { id: 'scout', title: 'Scout chat' } as NonNullable<Snapshot['conversations']>[number],
    ];
    expect(subject({ conversations, queue: queued })).toBe('Scout chat');
    // With no conversation in the snapshot, the run's queue names it; with neither, "Chat".
    expect(subject({ queue: queued })).toBe('Offer comparison');
    expect(subject({})).toBe('Chat');
  });
});
