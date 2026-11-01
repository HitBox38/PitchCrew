import type { Card } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { changeEvents, loadCardChanges, type CardChangesPage } from '../job-changes.ts';
import { jobEvents } from '../job-events.ts';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 30, 10, minute)).toISOString();

describe('loadCardChanges', () => {
  const pages: Record<string, CardChangesPage> = {
    newest: {
      changes: [{ id: 300, at: at(50), actor: 'writer', state: 'in_review' }],
      older: 101,
      reachedAt: at(30),
    },
    101: {
      changes: [{ id: 90, at: at(20), actor: 'writer', packet: 'drafted' }],
      older: 5,
      reachedAt: at(5),
    },
    5: {
      changes: [{ id: 2, at: at(1), actor: 'user', state: 'shortlisted' }],
      older: null,
      reachedAt: at(0),
    },
  };
  const page = (asked: number[]) => async (before?: number) => {
    asked.push(before ?? 0);
    return pages[before ?? 'newest'];
  };

  it('pages until it reaches the conversation start, oldest first', async () => {
    const asked: number[] = [];
    const changes = await loadCardChanges(page(asked), at(10));
    expect(asked).toEqual([0, 101]);
    expect(changes.map((change) => change.id)).toEqual([90, 300]);
  });

  it('stops at the end of history or the page bound', async () => {
    const all: number[] = [];
    expect(await loadCardChanges(page(all), at(0))).toHaveLength(3);
    expect(all).toEqual([0, 101, 5]);
    const bounded: number[] = [];
    expect(await loadCardChanges(page(bounded), at(0), 1)).toHaveLength(1);
    expect(bounded).toEqual([0]);
  });
});

describe('changeEvents', () => {
  it('turns saved changes into chips that replace recent-event chips of the same event', () => {
    const saved = changeEvents([
      { id: 7, at: at(4), actor: 'user', state: 'shortlisted' },
      { id: 8, at: at(6), actor: 'writer', state: 'drafting', packet: 'drafted' },
    ]);
    expect(saved.map((event) => [event.id, event.label])).toEqual([
      ['status-7', 'Shortlisted'],
      ['packet-8', 'Packet drafted'],
      ['status-8', 'Drafting'],
    ]);
    const card = {
      id: 'card-1',
      state: 'drafting',
      packet: null,
      createdAt: at(0),
      updatedAt: at(6),
    } as unknown as Card;
    const recent = [
      {
        id: 8,
        version: 32,
        kind: 'card',
        entityId: 'card-1',
        actor: 'writer',
        message: 'Moved to drafting',
        data: card,
        createdAt: at(6),
      },
    ] as never;
    const labels = jobEvents(card, [], recent, at(5), saved).map((event) => event.id);
    expect(labels).toEqual(['packet-8', 'status-8']);
  });
});
