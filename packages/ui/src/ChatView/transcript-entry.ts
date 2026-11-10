import type { ChatMessage, ChatRequest, Snapshot, TranscriptItem } from '@pitchcrew/core';
import type { MessageTranscriptProps } from './types.ts';
import type { PlacedJobEvents } from './job-events.ts';

export type TranscriptEntryProps = Omit<MessageTranscriptProps, 'messages' | 'focusRunId'> & {
  item: TranscriptItem;
  /** Added since the page opened: it enters, and as a user message the scroller pins it. */
  fresh: boolean;
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
const read = ['cards', 'roles', 'skills', 'profile', 'approvals', 'memories'] as const;
/** Of the conversations (which change with every message's preview), only the attached job. */
const jobOf = (props: TranscriptEntryProps) =>
  props.data.conversations?.find((item) => item.id === props.thread)?.cardId;
const requestOf = (data: Snapshot, message: ChatMessage): ChatRequest | undefined =>
  message.from === 'user'
    ? data.chatRequests?.find((request) => request.messageId === message.id)
    : undefined;
/** A user message whose every delivery was cancelled before it reached an agent. */
export const cancelledUnsent = (data: Snapshot, message: ChatMessage) => {
  const deliveries = requestOf(data, message)?.deliveries ?? [];
  return (
    !!deliveries.length &&
    deliveries.every((delivery) => !delivery.runId && delivery.status === 'cancelled')
  );
};

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
    a.fresh === b.fresh &&
    a.day === b.day &&
    a.events === b.events &&
    a.continued === b.continued &&
    a.replying === b.replying &&
    a.reduced === b.reduced &&
    a.thread === b.thread &&
    a.onOpenCard === b.onOpenCard &&
    a.answerQuestion === b.answerQuestion &&
    jobOf(a) === jobOf(b) &&
    read.every((key) => a.data[key] === b.data[key])
  );
};
