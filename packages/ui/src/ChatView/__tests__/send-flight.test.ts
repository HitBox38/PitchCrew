import { expect, it } from 'vitest';
import {
  confirmPendingSend,
  pendingMessageId,
  pendingSendId,
  entryTops,
  sameSend,
  transcriptKey,
} from '../send-flight.ts';

const pending = {
  id: 'send-1',
  text: ' Hi ',
  references: [],
  createdAt: '2026-11-10T10:00:00.000Z',
  before: ['older'],
};
const saved = {
  id: 'm1',
  threadId: 'a',
  from: 'user' as const,
  to: 'crew' as const,
  content: 'Hi',
  cardId: null,
  runId: null,
  createdAt: '2026-11-10T09:59:00.000Z',
};

it('identifies an unlinked saved message by its text, unless it was already on screen', () => {
  expect(sameSend(pending, saved)).toBe(true);
  expect(sameSend(pending, { ...saved, id: 'older' })).toBe(false);
  expect(sameSend(pending, { ...saved, from: 'career-coach' })).toBe(false);
});

it('keeps the saved message under its pending copy key', () => {
  expect(pendingSendId(pendingMessageId('send-1'))).toBe('send-1');
  expect(transcriptKey('m2')).toBe('m2');
  confirmPendingSend('m2', 'send-2');
  expect(transcriptKey('m2')).toBe(pendingMessageId('send-2'));
});

it('estimates where a new message appears and where the scroller pins it', () => {
  const at = { viewportTop: 100, scrollTop: 400, padding: 16, gap: 24 };
  // A long chat: it appears below the last entry, then scrolls up to 64px below the top padding.
  expect(entryTops({ ...at, previousBottom: 600 })).toEqual({ natural: 624, pinned: 180 });
  // A short chat that cannot scroll back past its start keeps the entry where it falls.
  expect(entryTops({ ...at, scrollTop: 0, previousBottom: 130 })).toEqual({
    natural: 154,
    pinned: 154,
  });
});
