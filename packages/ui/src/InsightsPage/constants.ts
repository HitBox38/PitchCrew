import type { Outcome, TagSort } from '@pitchcrew/core/insights';

export const sortOptions: readonly { value: TagSort; label: string }[] = [
  { value: 'count', label: 'Applications' },
  { value: 'positive', label: 'Positive share' },
  { value: 'weight', label: 'Average weight' },
  { value: 'tag', label: 'Tag name' },
];

export const outcomeHints: Record<Outcome, string> = {
  positive: 'Interviewing or offer',
  negative: 'Rejected or no response',
  neutral: 'Withdrawn',
  pending: 'Still in progress',
};
