import { describe, expect, it } from 'vitest';
import type { SinceLine } from '@/lib/since.ts';
import { sinceWindow } from '@/lib/since.ts';
import { readSeen, writeSeen } from '../../../hooks/useHomeSeen.ts';
import { sinceButtonWords, sinceDays, sinceHint, sinceWindowTitle } from '../helpers.ts';

const now = Date.parse('2026-11-18T15:00:00');
const line = (id: string, at: string): SinceLine => ({
  id,
  at,
  kind: 'finished',
  tone: 'primary',
  who: 'writer',
  text: id,
  target: null,
});

describe('since lines', () => {
  it('groups newest-first lines by local day, keeping their order', () => {
    const days = sinceDays(
      [
        line('a', '2026-11-18T14:00:00'),
        line('b', '2026-11-18T08:00:00'),
        line('c', '2026-11-17T22:00:00'),
        line('d', '2026-11-12T10:00:00'),
      ],
      now,
    );
    expect(days.map((day) => [day.label, day.lines.map((entry) => entry.id)])).toEqual([
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
      [days[2]!.label, ['d']],
    ]);
    expect(days[2]!.label).not.toMatch(/overnight|away/i);
  });

  it('says where each line leads', () => {
    expect(sinceHint({ item: 'question:q1' })).toBe('In Needs you');
    expect(sinceHint({ cardId: 'acme' })).toBe('Job details');
    expect(sinceHint({ thread: 't1', run: 'r1' })).toBe('Conversation');
    expect(sinceHint({ to: '/pipeline', search: { mode: 'table' } })).toBe('Pipeline');
    expect(sinceHint(null)).toBe('');
  });

  it('words the heading’s button long, or short enough for a phone', () => {
    const range = sinceWindow('2026-11-18T09:30:00', now);
    expect(sinceButtonWords('2 finished · 1 new ask', range).long).toBe('2 finished · 1 new ask');
    expect(sinceButtonWords('', range).long).toBe('nothing recorded');
    expect(sinceButtonWords('', range).short).toMatch(/^Since \d/);
  });

  it('claims a last visit only when this device stored one, and never that it starts a capped window', () => {
    expect(sinceWindowTitle(sinceWindow(null, now))).toBeUndefined();
    expect(sinceWindowTitle(sinceWindow('2026-11-18T09:30:00', now))).toBe(
      'Last opened on this device',
    );
    expect(sinceWindowTitle(sinceWindow('2026-11-01T09:30:00', now))).toBe(
      'Last opened on this device more than 7 days ago',
    );
  });
});

describe('the device’s last-seen mark', () => {
  const storage = () => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
  };

  it('stores a plain ISO time under its versioned key and reads it back', () => {
    const store = storage();
    expect(readSeen(store)).toBeNull();
    writeSeen(new Date('2026-11-18T09:30:00.000Z'), store);
    expect(store.getItem('pitchcrew-home-seen-v1')).toBe('2026-11-18T09:30:00.000Z');
    expect(readSeen(store)).toBe('2026-11-18T09:30:00.000Z');
  });

  it('survives blocked or missing storage', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readSeen(blocked)).toBeNull();
    expect(() => writeSeen(new Date(), blocked)).not.toThrow();
    expect(readSeen(null)).toBeNull();
  });
});
