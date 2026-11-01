import { describe, expect, it } from 'vitest';
import type { Card, Snapshot } from '@pitchcrew/core';
import { validateInboxSearch } from '../../navigation.ts';
import { decisionSummary } from '../jobs.ts';

const snapshot = (cards: Partial<Card>[]) =>
  ({
    cards: cards.map((fields, index) => ({
      id: `card-${index}`,
      state: 'shortlisted',
      updatedAt: '2026-10-30T09:00:00.000Z',
      applicationContext: { revision: 'a', createdAt: `2026-10-30T0${index}:00:00.000Z` },
      ...fields,
    })),
    roles: [],
    runs: [],
    approvals: [],
    computerApprovals: [],
  }) as unknown as Snapshot;

describe('clay decisions page', () => {
  it('summarizes waiting decisions in the page heading', () => {
    expect(decisionSummary(snapshot([]))).toBe('Nothing is waiting on you.');
    expect(decisionSummary(snapshot([{}]))).toBe('1 decision is waiting on you, oldest first.');
    expect(decisionSummary(snapshot([{}, {}]))).toBe(
      '2 decisions are waiting on you, oldest first.',
    );
  });

  it('accepts only decision identifiers in the inbox search', () => {
    expect(validateInboxSearch({ decision: 'brief-card-1' })).toEqual({
      decision: 'brief-card-1',
    });
    expect(validateInboxSearch({ decision: '../settings' })).toEqual({ decision: undefined });
    expect(validateInboxSearch({ decision: 4 })).toEqual({ decision: undefined });
    expect(validateInboxSearch({ view: 'history', entry: 'packet:approval-1' })).toEqual({
      view: 'history',
      entry: 'packet:approval-1',
    });
    expect(validateInboxSearch({ view: 'board', entry: 'packet:approval-1' })).toEqual({});
    expect(validateInboxSearch({ view: 'history', entry: '<script>' })).toEqual({
      view: 'history',
    });
  });
});
