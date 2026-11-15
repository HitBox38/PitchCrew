import { defaultFilter } from 'cmdk';
import type { Card, Conversation, Snapshot } from '@pitchcrew/core';
import { settingEntries } from '../SettingsPage/search.ts';

export const jobCommandValue = (card: Card) => {
  return `${card.title} ${card.company} ${card.location} ${card.tags.join(' ')} ${card.id}`;
};

/** Match and rank the entire board with the same fuzzy scorer cmdk uses. */
export const matchingJobCommands = (cards: Card[], search: string) => {
  const entries = cards.map((card) => ({ card, value: jobCommandValue(card) }));
  if (!search) return entries;
  return entries
    .map((entry) => ({ ...entry, score: defaultFilter(entry.value, search) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
};

/**
 * Profile note text by palette value, lower-cased once per change. Notes match their text with
 * a plain search: fuzzy-scoring whole note bodies on every key press stalls the palette.
 */
const noteBodies = new Map<string, string>();

let indexed: unknown = null;
// The name and the first heading (at most 120 characters) are fuzzy-scored; the text is not.
const noteValue = (note: { name: string; content: string }) =>
  `note ${note.name} ${/^#\s+(.+)$/m.exec(note.content)?.[1]?.trim().slice(0, 120) ?? ''}`.trim();

/** Indexes the notes' text (once per new list); returns each note's palette value. */
export const indexNotes = (notes: { name: string; content: string }[]) => {
  if (indexed !== notes) {
    noteBodies.clear();
    for (const note of notes) noteBodies.set(noteValue(note), note.content.toLocaleLowerCase());
    indexed = notes;
  }
  return noteValue;
};

/**
 * What of the search a note's text contains, as the words to show and reveal: the whole phrase,
 * or, when every word appears but not side by side, the longest word. Empty for no match.
 */
const textHit = (body: string | undefined, search: string) => {
  const needle = search.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  if (!body || needle.length < 2) return '';
  if (body.includes(needle)) return needle;
  const words = needle.split(' ');
  if (words.length < 2 || !words.every((word) => body.includes(word))) return '';
  return words.reduce((longest, word) => (word.length > longest.length ? word : longest));
};

/** The part of the search a note's text contains (see `textHit`), or ''. */
export const noteTextHit = (value: string, search: string) =>
  textHit(noteBodies.get(value), search);
const noteTextMatches = (value: string, search: string) => !!noteTextHit(value, search);

/** Some note's text contains the search. */
export const anyNoteText = (search: string) => {
  for (const body of noteBodies.values()) if (textHit(body, search)) return true;
  return false;
};

/**
 * Keep paging in cmdk's registered keyboard selection, below every matching result. Settings
 * entries drop near-zero scattered-letter matches so they never crowd out real results; notes
 * found by their text rank below name matches.
 */
export const commandFilter = (value: string, search: string, keywords?: string[]) => {
  if (value === `${jobPagePrefix}previous` || value === `${jobPagePrefix}next`)
    return Number.MIN_VALUE;
  const score = defaultFilter(value, search, keywords);
  // Text found in a note outranks scattered-letter matches, but not a real name match.
  if (noteTextMatches(value, search)) return Math.max(score, noteTextScore);
  return value.startsWith('Settings ') && score < 0.01 ? 0 : score;
};

export const jobPagePrefix = 'pitchcrew:job-page:';
export const noteTextScore = 0.6;

/**
 * React re-renders undo cmdk's DOM group sort, so rank jobs and settings before rendering.
 * `floor` is the score other results already reach (a note containing the words).
 */
export const settingsRankFirst = (cards: Card[], search: string, floor = 0) => {
  if (search.trim().length < 2) return false;
  const job = Math.max(floor, ...cards.map((card) => defaultFilter(jobCommandValue(card), search)));
  const setting = Math.max(
    ...settingEntries.map((entry) =>
      commandFilter(`Settings ${entry.label}`, search, entry.keywords),
    ),
  );
  return setting > job;
};

/** With no search, recently opened jobs lead (newest first); the rest keep board order. */
export const recentJobsFirst = <T extends { card: Pick<Card, 'id'> }>(
  entries: T[],
  recentIds: string[],
) => {
  const rank = new Map(recentIds.map((id, index) => [id, index]));
  return entries
    .map((entry, index) => ({ entry, index, recent: rank.get(entry.card.id) ?? Infinity }))
    .sort((a, b) => a.recent - b.recent || a.index - b.index)
    .map(({ entry }) => entry);
};

type ConversationSource = Pick<Snapshot, 'cards' | 'roles'> & { conversations?: Conversation[] };

/** Where a conversation lives: its job, or who is in it. */
const conversationContext = (conversation: Conversation, data: ConversationSource) => {
  const card = conversation.cardId
    ? data.cards.find((item) => item.id === conversation.cardId)
    : undefined;
  if (card) return `${card.company} · ${card.title}`;
  const names = conversation.participants.map(
    (id) => data.roles.find((role) => role.id === id)?.name ?? id,
  );
  return names.join(', ');
};

/**
 * Conversations by fuzzy match across title, job and participants. With no search, the five
 * most recently active open conversations; with a search, the best eight, archived included.
 */
export const matchingConversations = (data: ConversationSource, search: string) => {
  const entries = (data.conversations ?? [])
    .filter((conversation) => !conversation.deletedAt)
    .map((conversation) => {
      const context = conversationContext(conversation, data);
      return {
        conversation,
        context,
        value: `${conversation.title} ${context} ${conversation.id}`,
      };
    });
  if (!search.trim())
    return entries
      .filter((entry) => !entry.conversation.archived)
      .sort((a, b) => b.conversation.updatedAt.localeCompare(a.conversation.updatedAt))
      .slice(0, 5);
  return entries
    .map((entry) => ({ ...entry, score: defaultFilter(entry.value, search) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
};
