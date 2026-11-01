import type { CardState } from '@pitchcrew/core';

export type BoardStage = {
  id: string;
  label: string;
  states: CardState[];
  color: string;
  empty: string;
  /** Former column ids whose saved sort choice this column adopts. */
  legacy?: string[];
};
export const closedStates: CardState[] = ['rejected', 'withdrawn', 'ghosted'];
export const closedStateSet: ReadonlySet<CardState> = new Set(closedStates);
export const stages: BoardStage[] = [
  {
    id: 'lead',
    label: 'Leads',
    states: ['lead'],
    color: 'slate',
    empty: 'Add a job post to start.',
  },
  {
    id: 'shortlisted',
    label: 'Shortlisted',
    states: ['shortlisted'],
    color: 'blue',
    empty: 'Shortlist a lead once Scout has read it.',
  },
  {
    id: 'progress',
    label: 'In progress',
    states: ['drafting', 'in_review', 'changes_requested', 'agreed', 'awaiting_approval'],
    color: 'violet',
    legacy: ['drafts', 'ready'],
    empty: 'Drafts, reviews and packets waiting for approval land here.',
  },
  {
    id: 'applied',
    label: 'Applied',
    states: ['submitted', 'screening', 'interviewing', 'offer'],
    color: 'green',
    empty: 'Jobs you’ve applied to land here.',
  },
];

export const closedStage: BoardStage = {
  id: 'closed',
  label: 'Closed',
  states: closedStates,
  color: 'pink',
  empty: 'Rejected, withdrawn and unanswered applications end up here.',
};
export const dropStages = [...stages, closedStage];
