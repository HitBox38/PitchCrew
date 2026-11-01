import type { Outcome, TagSort } from '@pitchcrew/core/insights';

export const sortOptions: readonly { value: TagSort; label: string }[] = [
  { value: 'count', label: 'Applications' },
  { value: 'positive', label: 'Positive share' },
  { value: 'weight', label: 'Average weight' },
  { value: 'tag', label: 'Tag name' },
];

/** The figures strip names what each outcome group actually contains. */
export const outcomeHints: Record<Outcome, string> = {
  positive: 'Interviewing or offer',
  negative: 'Rejected or no response',
  neutral: 'Withdrawn',
  pending: 'In progress',
};

/** Tag rows and lessons shown before their Show all disclosure. */
export const tagPreview = 4;
