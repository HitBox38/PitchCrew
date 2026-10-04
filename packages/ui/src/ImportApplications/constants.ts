import type { ImportRowStatus } from '@pitchcrew/core';

// Mirrors the daemon limits in @pitchcrew/core importLimits; the daemon rechecks both.
export const maxImportBytes = 2 * 1024 * 1024;
export const maxImportRows = 1000;

export const importStatusLabels: Record<ImportRowStatus, string> = {
  new: 'New',
  created: 'Imported',
  imported: 'Already imported',
  duplicate: 'Duplicate',
  invalid: 'Invalid',
  failed: 'Failed',
};
