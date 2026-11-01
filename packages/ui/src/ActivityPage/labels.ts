import type { BoardEvent, RuntimeId } from '@pitchcrew/core';
import { runtimeLabels, stateLabels } from '../lib/labels.ts';

/** Resolves a stored actor or role ID (or a conversation ID) to the name the user knows. */
export type NameOf = (id: string) => string | undefined;

type ActivityEvent = Pick<BoardEvent, 'kind' | 'message'> & Partial<Pick<BoardEvent, 'data'>>;

const fixed: Record<string, string> = {
  'Released application': 'Released the job for the next step',
  'Created work queue': 'Started a queue',
  'Updated work queue': 'Updated the queue',
  'Updated queued message': 'Updated a queued message',
  'Edited queued message': 'Edited a queued message',
  'Recovered saved user request': 'Recovered a saved request after a restart',
  'Conversation activity': 'Conversation updated',
  'Saved turn activity': 'Saved the turn’s steps',
  'Linked the user question': 'Asked you a question',
  'Answered user question': 'Answered a question',
  'Recorded memory sources': 'Saved the memories a reply used',
  'Preserved legacy crew history': 'Kept the earlier crew history',
  'Preserved agent conversation': 'Kept an earlier agent conversation',
  'Consumed approval for local export': 'Used the approval for the local export',
  'Example of a manually tracked submission': 'Recorded a submission you made yourself',
  'Example interview stage': 'Recorded the interview stage',
  'Example fit score': 'Scored the job’s fit',
  'Simulated review of the fictional example brief': 'Reviewed the application brief',
  'Created a fictional sample packet': 'Drafted a sample packet',
};

const stages = Object.fromEntries(
  Object.entries(stateLabels).map(([state, label]) => [state.replaceAll('_', ' '), label]),
) as Record<string, string>;

const party = (id: string, nameOf: NameOf) =>
  id === 'crew' ? 'the crew' : id === 'user' ? 'you' : (nameOf(id) ?? id);

const importedApplication = /^Imported a past application \(import key (\w+)\)[;,]?\s*(.*)$/;
const importedStatus = /^Imported past status (.+) effective (\S+)$/;

/** Conversation messages and example records named by who acted and where. */
const recordSentence = (event: ActivityEvent, nameOf: NameOf, titleOf: NameOf) => {
  const fields = (event.data ?? {}) as { from?: string; roleId?: string; threadId?: string };
  const title = fields.threadId ? titleOf(fields.threadId) : undefined;
  const where = title ? ` in “${title}”` : '';
  if (event.kind === 'message') {
    const from = fields.from;
    if (from === 'user') return title ? `You messaged “${title}”` : 'You sent a message';
    if (from && from !== 'system' && nameOf(from))
      return title ? `${nameOf(from)} messaged “${title}”` : `${nameOf(from)} sent a message`;
    return title ? `New message in “${title}”` : 'New message';
  }
  const role = fields.roleId ? (nameOf(fields.roleId) ?? 'An agent') : 'An agent';
  if (event.kind === 'run') return `${role} replied${where}`;
  if (event.kind === 'user_input') return `${role} asked you a question${where}`;
  if (event.kind === 'task') return `Queued a follow-up for ${role}`;
  return undefined;
};

/**
 * The sentence an event shows in Activity: stored wording rewritten into product language
 * (stage names, role names, plain verbs). Stored events are never changed; unknown wording
 * passes through unchanged.
 */
export const activitySentence = (
  event: ActivityEvent,
  nameOf: NameOf,
  titleOf: NameOf = () => undefined,
): string => {
  const message = event.message.trim();
  if (fixed[message]) return fixed[message];
  if (event.kind === 'card' && importedApplication.test(message))
    return 'Imported a past application';
  const imported = importedStatus.exec(message);
  if (imported && stages[imported[1]]) return `Imported past status: ${stages[imported[1]]}`;
  const moved = /^Moved to (.+)$/.exec(message);
  if (moved && event.kind === 'card' && stages[moved[1]]) return `Moved to ${stages[moved[1]]}`;
  const messaged = /^(\S+) messaged (\S+)$/.exec(message);
  if (messaged && event.kind === 'message') {
    const from = messaged[1] === 'You' ? 'You' : party(messaged[1], nameOf);
    return `${from} messaged ${party(messaged[2], nameOf)}`;
  }
  if (/^Example (conversation message|chat turn|question|crew follow-up)$/.test(message))
    return recordSentence(event, nameOf, titleOf) ?? message;
  const started = /^Started (.+) on (\S+)$/.exec(message);
  if (started && event.kind === 'run' && started[2] in runtimeLabels)
    return `Started ${started[1]} with ${runtimeLabels[started[2] as RuntimeId]}`;
  if (event.kind === 'role' && message.startsWith('Initialized '))
    return `Added ${message.slice(12)} to the crew`;
  if (event.kind === 'conversation' && message.startsWith('Created '))
    return `Started the conversation “${message.slice(8)}”`;
  return message;
};

/** The stored specifics a rewritten sentence leaves out (dates, import keys), shown on request. */
export const activityDetail = (event: Pick<BoardEvent, 'kind' | 'message'>) => {
  const message = event.message.trim();
  const application = event.kind === 'card' ? importedApplication.exec(message) : null;
  if (application) {
    const note = application[2].replace(/\.$/, '');
    const rest = note ? `. ${note[0]!.toUpperCase()}${note.slice(1)}.` : '.';
    return `Import key ${application[1]}${rest}`;
  }
  const status = importedStatus.exec(message);
  const at = status ? new Date(status[2]) : null;
  if (!status || !stages[status[1]] || !at || Number.isNaN(at.getTime())) return undefined;
  const dateOnly = status[2].endsWith('T00:00:00.000Z');
  return `Effective ${at.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : { hour: 'numeric', minute: '2-digit' }),
  })}`;
};
