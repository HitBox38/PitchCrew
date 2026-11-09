import { describe, expect, it } from 'vitest';
import type { Approval, Card, Snapshot } from '@pitchcrew/core';
import { packetNeedsAction } from '../../lib/inbox.ts';
import {
  cardLine,
  columnBeads,
  decisionSource,
  decisionTitle,
  jobStatus,
  nextUp,
} from '../jobs.ts';
import { cardPacketApproval, packetAction } from '../packet-guidance.ts';
import { decisions, jobSignals, signalAsks } from '../signals.ts';

const packet = { resume: 'Resume', coverLetter: '', formAnswers: '', note: '', claims: [] };

const job = (fields: Partial<Card> = {}) =>
  ({
    id: 'job',
    company: 'Acme (fictional)',
    title: 'Engineer',
    state: 'awaiting_approval',
    fit: 80,
    location: '',
    packet,
    packetReview: { runId: 'review-run', contextRevision: 'r1' },
    applicationContext: {
      revision: 'r1',
      confirmedRevision: 'r1',
      confirmedAt: '2026-11-01T00:00:00.000Z',
      requirements: [],
      createdAt: '2026-11-01T00:00:00.000Z',
    },
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...fields,
  }) as unknown as Card;

const approval = (fields: Partial<Approval> = {}) =>
  ({
    id: 'approval',
    cardId: 'job',
    action: 'export_packet',
    digest: 'd',
    packet,
    contextRevision: 'r1',
    status: 'pending',
    createdAt: '2026-11-02T00:00:00.000Z',
    decidedAt: null,
    ...fields,
  }) as Approval;

const snapshot = (approvals: Approval[], fields: Partial<Snapshot> = {}) =>
  ({
    cards: [job()],
    roles: [
      { id: 'reviewer', name: 'Reviewer', enabled: true },
      { id: 'submitter', name: 'Submitter', enabled: true },
    ],
    runs: [{ id: 'review-run', roleId: 'reviewer', cardId: 'job', status: 'completed' }],
    approvals,
    computerApprovals: [],
    ...fields,
  }) as unknown as Snapshot;

const exported = approval({
  status: 'consumed',
  decidedAt: '2026-11-02T01:00:00.000Z',
  exportDirectory: '/fictional/exports/acme',
  submission: { method: 'manual' },
});

const surfaces = (data: Snapshot) => {
  const [decision] = decisions(data);
  const card = data.cards[0]!;
  const signal = jobSignals(data).get(card.id) ?? {};
  return {
    decision: decision!,
    status: jobStatus(card, signal, data.roles),
    line: cardLine(card, signal, data).text,
    title: decisionTitle(decision!, data),
    source: decisionSource(decision!, data).text,
    next: nextUp(card, data)?.text,
    action: packetAction(decision!.stage),
  };
};

describe('packet decision guidance', () => {
  it('keeps approval wording while the packet waits for approval', () => {
    const view = surfaces(snapshot([approval()]));
    expect(view.decision.stage).toBe('approve');
    expect(view.status).toBe('Approve packet');
    expect(view.line).toBe('Approve packet');
    expect(view.title).toBe('Approve the Acme (fictional) packet?');
    expect(view.source).toBe('Reviewer agreed');
    expect(view.next).toBe('Waiting on you: Approve the Acme (fictional) packet?');
    expect(view.action).toBe('Review');
  });

  it('asks how to apply once the packet is approved but not exported', () => {
    const view = surfaces(
      snapshot([approval({ status: 'approved', decidedAt: '2026-11-02T01:00:00.000Z' })]),
    );
    expect(view.decision.stage).toBe('choose');
    expect(view.status).toBe('Choose how to apply');
    expect(view.title).toBe('Choose how to apply to Acme (fictional)');
    expect(view.source).toBe('You approved');
    expect(view.action).toBe('Continue application');
    expect(JSON.stringify(view)).not.toMatch(/Approve/u);
  });

  it('guides an exported manual packet to apply first and record it after, never to re-approve', () => {
    const data = snapshot([exported]);
    const view = surfaces(data);
    expect(view.decision.stage).toBe('apply');
    expect(view.status).toBe('Ready to apply');
    expect(view.line).toBe('Ready to apply');
    expect(view.title).toBe('Apply to Acme (fictional), then record it');
    expect(view.next).toBe('Waiting on you: Apply to Acme (fictional), then record it');
    expect(view.source).toBe('You exported the files');
    expect(view.decision.detail).toContain('Nothing has been sent');
    expect(view.action).toBe('Continue application');
    expect(JSON.stringify(view)).not.toMatch(/Approve|submitted/u);
    // Presentation only: the job is still awaiting approval, not recorded as submitted.
    expect(data.cards[0]!.state).toBe('awaiting_approval');
  });

  it('does not treat a manual choice without verified exported files as ready to apply', () => {
    const view = surfaces(
      snapshot([approval({ status: 'approved', submission: { method: 'manual' } })]),
    );
    expect(view.decision.stage).toBe('choose');
  });

  it('follows an agent handoff through its delivery without claiming progress', () => {
    const handoff = approval({
      status: 'consumed',
      exportDirectory: '/fictional/exports/acme',
      submission: { method: 'agent', roleId: 'submitter', threadId: 't', requestId: 'req' },
    });
    const request = (status: string) =>
      [{ id: 'req', deliveries: [{ status }] }] as unknown as Snapshot['chatRequests'];
    const running = surfaces(snapshot([handoff], { chatRequests: request('running') }));
    expect(running.decision.stage).toBe('preparing');
    expect(running.status).toBe('Agent preparing');
    expect(running.title).toBe('Check on the Acme (fictional) application');
    expect(running.source).toBe('Handed to Submitter');
    expect(running.decision.detail).toContain('Nothing is submitted until you approve');
    expect(running.next).not.toContain('Waiting on you');
    const failed = surfaces(snapshot([handoff], { chatRequests: request('failed') }));
    expect(failed.status).toBe('Preparation needs attention');
    expect(failed.next).toContain('Waiting on you');
    for (const status of ['completed', 'cancelled', 'paused', 'waiting']) {
      expect(
        signalAsks(jobSignals(snapshot([handoff], { chatRequests: request(status) })).get('job')!),
      ).toBe(true);
    }
  });

  it('keeps running preparation live and prioritizes a real browser approval on the same job', () => {
    const handoff = approval({
      status: 'consumed',
      exportDirectory: '/fictional/exports/acme',
      submission: { method: 'agent', roleId: 'submitter', requestId: 'req' },
    });
    const data = snapshot([handoff], {
      chatRequests: [
        { id: 'req', deliveries: [{ status: 'running' }] },
      ] as Snapshot['chatRequests'],
      runs: [
        { id: 'r', roleId: 'submitter', cardId: 'job', status: 'running' },
      ] as Snapshot['runs'],
    });
    expect(signalAsks(jobSignals(data).get('job')!)).toBe(false);
    expect(nextUp(data.cards[0]!, data)).toMatchObject({ tone: 'working' });
    expect(columnBeads(data.cards, jobSignals(data))[0]).toMatchObject({
      tone: 'plum',
      live: true,
    });
    data.computerApprovals = [
      {
        id: 'browser',
        cardId: 'job',
        roleId: 'submitter',
        status: 'pending',
        reason: 'Approve the final click',
        createdAt: '2026-11-03T00:00:00.000Z',
      },
    ] as Snapshot['computerApprovals'];
    expect(decisions(data).map((item) => item.id)).toEqual(['approval', 'browser']);
    const signal = jobSignals(data).get('job')!;
    expect(signal.decision?.id).toBe('browser');
    expect(signalAsks(signal)).toBe(true);
    expect(columnBeads(data.cards, jobSignals(data))[0]).toMatchObject({
      tone: 'ochre',
      live: false,
    });
  });

  it('selects the newest current packet for direct handoff navigation', () => {
    const newer = { ...exported, id: 'newer', createdAt: '2026-11-03T00:00:00.000Z' };
    expect(cardPacketApproval(job(), [exported, newer])?.id).toBe('newer');
    expect(cardPacketApproval(job({ state: 'submitted' }), [exported, newer])).toBeUndefined();
  });

  it('asks to check an uncertain browser submission instead of applying again', () => {
    const handoff = approval({
      status: 'consumed',
      exportDirectory: '/fictional/exports/acme',
      submission: { method: 'agent', roleId: 'submitter', threadId: 't', requestId: 'req' },
    });
    const card = job({
      submissionAttempts: [
        { id: 'a', exportApprovalId: 'approval', status: 'uncertain' },
      ] as Card['submissionAttempts'],
    });
    const view = surfaces(snapshot([handoff], { cards: [card] }));
    expect(view.decision.stage).toBe('verify');
    expect(view.status).toBe('Verify submission');
    expect(view.title).toBe('Did the Acme (fictional) application go through?');
    expect(view.action).toBe('Check submission');
  });

  it('leaves attention eligibility and counts unchanged', () => {
    const stale = job({ packet: { ...packet, resume: 'Changed' } });
    const closed = job({ id: 'closed', state: 'submitted' });
    const cases: Snapshot[] = [
      snapshot([exported]),
      snapshot([exported], { cards: [stale] }),
      snapshot([{ ...exported, cardId: 'closed' }], { cards: [closed] }),
      snapshot([approval({ status: 'rejected' })]),
      snapshot([approval(), exported]),
    ];
    for (const data of cases) {
      const eligible = data.approvals.filter((item) => packetNeedsAction(item, data.cards));
      expect(decisions(data).map((item) => item.id)).toEqual(eligible.map((item) => item.id));
    }
    expect(decisions(cases[1]!)).toEqual([]);
    expect(decisions(cases[2]!)).toEqual([]);
  });

  it('keeps brief, browser and question wording', () => {
    const data = snapshot([], {
      cards: [job({ state: 'shortlisted', applicationContext: { revision: 'r2' } as never })],
      computerApprovals: [
        {
          id: 'b',
          cardId: 'job',
          roleId: 'submitter',
          status: 'pending',
          reason: 'Open the form',
          createdAt: '2026-11-03T00:00:00.000Z',
        },
      ] as unknown as Snapshot['computerApprovals'],
      userInputs: [
        {
          id: 'q',
          cardId: 'job',
          roleId: 'reviewer',
          threadId: 't',
          status: 'pending',
          question: 'Overlap?',
          createdAt: '2026-11-04T00:00:00.000Z',
        },
      ] as Snapshot['userInputs'],
    });
    const [brief, browser, question] = decisions(data);
    expect(brief?.stage).toBeUndefined();
    expect(decisionTitle(brief!, data)).toBe('Confirm the Acme (fictional) brief');
    expect(decisionTitle(browser!, data)).toBe('Submitter asks to use the browser');
    expect(decisionTitle(question!, data)).toBe('Reviewer has a question');
    expect(packetAction(browser!.stage)).toBe('Review');
    const signal = jobSignals(data).get('job') ?? {};
    expect(jobStatus(data.cards[0]!, signal, data.roles)).toBe('Confirm brief');
  });
});
