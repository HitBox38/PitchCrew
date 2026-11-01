import type { Approval, Card, ComputerApproval } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { historyGroups, historyTone } from '../helpers.ts';
import type { ApprovalRequest } from '../types.ts';

const packet = (id: string, createdAt: string, status: Approval['status'] = 'consumed') =>
  ({
    kind: 'packet',
    key: `packet:${id}`,
    approval: { id, cardId: 'job', status, createdAt } as Approval,
  }) satisfies ApprovalRequest;
const browser = (status: ComputerApproval['status']) =>
  ({
    kind: 'browser',
    key: `browser:${status}`,
    approval: { id: status, status, createdAt: '2026-10-30T09:00:00' } as ComputerApproval,
  }) satisfies ApprovalRequest;
const cards = (state: Card['state'], extra: Partial<Card> = {}) => ({
  cards: [{ id: 'job', state, ...extra } as Card],
});

describe('Inbox history', () => {
  it('groups newest-first decisions by today, yesterday, this week and month', () => {
    const now = new Date(2026, 9, 30, 15);
    const groups = historyGroups(
      [
        packet('a', new Date(2026, 9, 30, 9).toISOString()),
        packet('b', new Date(2026, 9, 30, 1).toISOString()),
        packet('c', new Date(2026, 9, 29, 22).toISOString()),
        packet('d', new Date(2026, 9, 26, 12).toISOString()),
        packet('e', new Date(2026, 8, 3, 12).toISOString()),
      ],
      now,
    );
    expect(groups.map((group) => [group.label, group.requests.length])).toEqual([
      ['Today', 2],
      ['Yesterday', 1],
      ['Earlier this week', 1],
      [new Date(2026, 8, 3).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), 1],
    ]);
  });

  it('colours outcomes by how the application moved on', () => {
    const done = packet('a', '2026-10-30T09:00:00');
    expect(historyTone(done, cards('interviewing'))).toBe('moss');
    expect(historyTone(done, cards('submitted'))).toBe('teal');
    expect(historyTone(done, cards('withdrawn'))).toBe('quiet');
    expect(historyTone(done, { cards: [] })).toBe('quiet');
    expect(historyTone(packet('r', '2026-10-30T09:00:00', 'rejected'), cards('drafting'))).toBe(
      'quiet',
    );
    expect(
      historyTone(
        done,
        cards('awaiting_approval', {
          submissionAttempts: [{ status: 'uncertain' }] as Card['submissionAttempts'],
        }),
      ),
    ).toBe('ochre');
    expect(historyTone(browser('failed'), { cards: [] })).toBe('ochre');
    expect(historyTone(browser('rejected'), { cards: [] })).toBe('quiet');
    expect(historyTone(browser('consumed'), { cards: [] })).toBe('teal');
  });
});
