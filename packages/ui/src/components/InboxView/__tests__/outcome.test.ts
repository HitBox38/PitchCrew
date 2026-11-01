import type { Approval, Card, ComputerApproval } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { decisionOutcome, decisionStage } from '../outcome.ts';
import type { ApprovalRequest } from '../types.ts';

const packet = (status: Approval['status']) =>
  ({
    kind: 'packet',
    key: `packet:${status}`,
    approval: { id: status, cardId: 'job', status, createdAt: '2026-10-30T09:00:00' } as Approval,
  }) satisfies ApprovalRequest;
const browser = (status: ComputerApproval['status']) =>
  ({
    kind: 'browser',
    key: `browser:${status}`,
    approval: { id: status, cardId: null, status } as ComputerApproval,
  }) satisfies ApprovalRequest;

describe('Decision outcomes', () => {
  it('names the saved decision, not the job’s later stage', () => {
    expect(decisionOutcome(packet('consumed'))).toEqual({ label: 'Approved', tone: 'teal' });
    expect(decisionOutcome(packet('approved')).label).toBe('Approved, not exported');
    expect(decisionOutcome(packet('rejected'))).toEqual({ label: 'Rejected', tone: 'quiet' });
    expect(decisionOutcome(packet('pending')).label).toBe('Expired');
    expect(decisionOutcome(browser('consumed')).label).toBe('Approved');
    expect(decisionOutcome(browser('failed')).tone).toBe('rose');
  });

  it('keeps the job stage as separate metadata', () => {
    const cards = [{ id: 'job', state: 'interviewing' } as Card];
    expect(decisionStage(packet('consumed'), { cards })).toEqual({ label: 'Interviewing' });
    expect(decisionStage(packet('consumed'), { cards: [] })).toEqual({ label: 'Job removed' });
    expect(decisionStage(browser('consumed'), { cards })).toBeUndefined();
    const uncertain = [
      {
        id: 'job',
        state: 'awaiting_approval',
        submissionAttempts: [{ status: 'uncertain', exportApprovalId: 'consumed' }],
      } as Card,
    ];
    expect(decisionStage(packet('consumed'), { cards: uncertain })).toEqual({
      label: 'Verify submission',
      attention: true,
    });
  });
});
