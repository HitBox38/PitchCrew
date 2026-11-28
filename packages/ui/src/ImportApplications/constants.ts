import type { ImportRowStatus } from '@pitchcrew/core';

export const importStatusLabels: Record<ImportRowStatus, string> = {
  new: 'New',
  created: 'Imported',
  imported: 'Already imported',
  duplicate: 'Duplicate',
  invalid: 'Invalid',
  failed: 'Failed',
};
