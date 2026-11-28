export type BoardAction = 'fit' | 'draft' | 'review' | 'deep-review' | 'reevaluate';
export const boardActionLabels: Record<BoardAction, string> = {
  fit: 'Evaluate fit',
  reevaluate: 'Reevaluate with packet',
  draft: 'Draft application',
  review: 'Review packet',
  'deep-review': 'Deep review resume',
};
