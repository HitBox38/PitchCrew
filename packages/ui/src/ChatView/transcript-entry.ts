import type { ChatMessage, ChatRequest, Snapshot, TranscriptItem } from '@pitchcrew/core';
import type { MessageTranscriptProps } from './types.ts';
import type { PlacedJobEvents } from './job-events.ts';

export type TranscriptEntryProps = Omit<MessageTranscriptProps, 'messages' | 'focusRunId'> & {
  item: TranscriptItem;
  /** A user message sent since the page opened, which the scroller pins. */
  anchor: boolean;
  /** Starts a new day, so it shows the day. */
  day: boolean;
  events?: PlacedJobEvents;
  continued: boolean;
  replying: boolean;
};

const shallow = (a: object, b: object) => {
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(right);
  return keys.length === Object.keys(left).length && keys.every((key) => left[key] === right[key]);
};
/** What an entry reads from the snapshot. A question or answer reads more, so it always renders. */
const read = [
  'cards',
  'conversations',
  'roles',
  'skills',
  'profile',
  'approvals',
  'memories',
] as const;
const requestOf = (data: Snapshot, message: ChatMessage): ChatRequest | undefined =>
  message.from === 'user'
    ? data.chatRequests?.find((request) => request.messageId === message.id)
    : undefined;

/**
 * Whether an entry would render the same. The store shares unchanged data across updates, so
 * comparing references is enough; `name` only reads the roles, which are compared, and the
 * handlers are stable.
 */
export const sameEntry = (a: TranscriptEntryProps, b: TranscriptEntryProps) => {
  const [x, y] = [a.item, b.item];
  if (x.kind !== y.kind || x.id !== y.id || x.createdAt !== y.createdAt) return false;
  if (x.kind === 'turn' && y.kind === 'turn' && !shallow(x.run, y.run)) return false;
  if (x.kind === 'message' && y.kind === 'message') {
    if (x.message !== y.message || y.message.userInput) return false;
    if (a.streamingIds.has(x.id) !== b.streamingIds.has(y.id)) return false;
    if (requestOf(a.data, x.message) !== requestOf(b.data, y.message)) return false;
  }
  return (
    a.anchor === b.anchor &&
    a.day === b.day &&
    a.events === b.events &&
    a.continued === b.continued &&
    a.replying === b.replying &&
    a.reduced === b.reduced &&
    a.thread === b.thread &&
    a.onOpenCard === b.onOpenCard &&
    a.answerQuestion === b.answerQuestion &&
    read.every((key) => a.data[key] === b.data[key])
  );
};
