import type { CardState } from '@pitchcrew/core';

export type BoardStage = {
  id: string;
  label: string;
  states: CardState[];
  color: string;
  empty: string;
};
export const closedStates: CardState[] = ['rejected', 'withdrawn', 'ghosted'];
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
    id: 'drafts',
    label: 'Drafting',
    states: ['drafting', 'in_review', 'changes_requested'],
    color: 'violet',
    empty: 'Writer’s drafts and Reviewer’s notes land here.',
  },
  {
    id: 'ready',
    label: 'Ready',
    states: ['agreed', 'awaiting_approval'],
    color: 'orange',
    empty: 'Reviewed packets wait here for your approval.',
  },
  {
    id: 'applied',
    label: 'Applied',
    states: ['submitted', 'screening', 'interviewing', 'offer'],
    color: 'green',
    empty: 'Record a submission after you apply.',
  },
];

export const closedStage = {
  id: 'closed',
  label: 'Closed',
  states: closedStates,
  color: 'pink',
  empty: 'Rejected, withdrawn and unanswered applications end up here.',
};
export const dropStages = [...stages, closedStage];
