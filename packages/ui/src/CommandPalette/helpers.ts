import { defaultFilter } from 'cmdk';
import type { Card } from '@pitchcrew/core';
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
 * Keep paging in cmdk's registered keyboard selection, below every matching result. Settings
 * entries drop near-zero scattered-letter matches so they never crowd out real results.
 */
export const commandFilter = (value: string, search: string, keywords?: string[]) => {
  if (value === `${jobPagePrefix}previous` || value === `${jobPagePrefix}next`)
    return Number.MIN_VALUE;
  const score = defaultFilter(value, search, keywords);
  return value.startsWith('Settings ') && score < 0.01 ? 0 : score;
};

export const jobPagePrefix = 'pitchcrew:job-page:';

/** React re-renders undo cmdk's DOM group sort, so rank jobs and settings before rendering. */
export const settingsRankFirst = (cards: Card[], search: string) => {
  if (search.trim().length < 2) return false;
  const job = Math.max(0, ...cards.map((card) => defaultFilter(jobCommandValue(card), search)));
  const setting = Math.max(
    ...settingEntries.map((entry) =>
      commandFilter(`Settings ${entry.label}`, search, entry.keywords),
    ),
  );
  return setting > job;
};
