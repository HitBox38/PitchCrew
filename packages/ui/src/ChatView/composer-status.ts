import { chatTokens } from '@pitchcrew/core/chat-references';

/** Joins agent names as readable prose, collapsing long lists to a count. */
export const nameList = (names: string[]) => {
  const unique = [...new Set(names)];
  if (unique.length > 3) return `${unique.length} agents`;
  if (unique.length < 2) return unique[0] ?? '';
  return `${unique.slice(0, -1).join(', ')} and ${unique.at(-1)}`;
};

/**
 * Mirrors the daemon's routing: @mentions of participants address only them, and an unaddressed
 * message goes to every participant. Mentions of non-participants leave no target.
 */
export const messageTargets = (draft: string, participants: string[]) => {
  const mentions = new Set(
    chatTokens(draft)
      .filter((token) => token.symbol === '@')
      .map((token) => token.query),
  );
  return mentions.size ? participants.filter((id) => mentions.has(id)) : participants;
};

export const recipientLabel = (
  targets: string[],
  participants: string[],
  name: (id: string) => string,
) => {
  if (participants.length <= 1) return name(participants[0] ?? '');
  if (!targets.length) return 'No participant';
  if (targets.length === participants.length) return 'Everyone';
  return nameList(targets.map(name));
};

export interface SendNoteInput {
  hasInput: boolean;
  busy: boolean;
  busyElsewhere: boolean;
  sendMode: 'queue' | 'interrupt';
  /** Agents running a turn in this conversation. */
  running: string[];
  /** Agents whose pending question holds this conversation's queue. */
  asking: string[];
}

/** The two follow-up choices offered while a turn runs, worded for what each actually does. */
export const followUpLabels = ({
  busyElsewhere,
  running,
}: Pick<SendNoteInput, 'busyElsewhere' | 'running'>) => {
  const names = nameList(running);
  return busyElsewhere || !names
    ? { queue: 'Sends after current job work finishes', interrupt: 'Stops current work and sends' }
    : {
        queue: `Sends after ${names} ${new Set(running).size > 1 ? 'finish' : 'finishes'}`,
        interrupt: `Interrupts ${names}`,
      };
};

/** What happens to the drafted message right now, or nothing when it simply sends. */
export const sendNote = (input: SendNoteInput) => {
  if (!input.hasInput) return '';
  if (input.busy) return followUpLabels(input)[input.sendMode];
  if (input.asking.length) return `Sends after you answer ${nameList(input.asking)}`;
  return '';
};
