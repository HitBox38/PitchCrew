import type { ChatReference } from '@pitchcrew/core';
import { followUpLabels, sendNote, type SendNoteInput } from '../ChatView/composer-status.ts';
import { composerRetryNote, type ComposerRetryMode } from '../ChatView/composer-retry.ts';

/**
 * The clay expanded browser's message box edits the conversation's shared draft as plain text.
 * Reference chips before the edited span keep their place, chips after it shift by the length
 * change, and chips the edit touches are dropped (their text stays as ordinary characters).
 */
export const remapReferences = (
  before: string,
  after: string,
  references: ChatReference[],
): ChatReference[] => {
  if (before === after) return references;
  const shortest = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < shortest && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < shortest - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++;
  const editEnd = before.length - suffix;
  const delta = after.length - before.length;
  return references.flatMap((reference) => {
    if (reference.end <= prefix) return [reference];
    if (reference.start >= editEnd)
      return [{ ...reference, start: reference.start + delta, end: reference.end + delta }];
    return [];
  });
};

/** The message box's label and the note under it: what sending does right now, and any files
 * already attached in the chat composer that the same send includes. */
export const replyCopy = ({
  group,
  name,
  files,
  status,
  retryMode,
}: {
  group: boolean;
  name: string;
  files: number;
  status: SendNoteInput;
} & ComposerRetryMode) => ({
  label: `Message ${group ? 'the group' : name}`,
  note: [
    composerRetryNote(retryMode) ||
      (status.busy ? followUpLabels(status)[status.sendMode] : sendNote(status)),
    files ? `Includes ${files} ${files === 1 ? 'file' : 'files'} attached in chat` : '',
  ]
    .filter(Boolean)
    .join(' · '),
});
