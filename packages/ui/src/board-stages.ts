export const closedStates = ['rejected', 'withdrawn', 'ghosted'];
export const stages = [
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
