import { convertLegacyTracker } from '@pitchcrew/board';
import { importLimits } from '@pitchcrew/core';
import type { DatabaseImportConversion } from '@pitchcrew/core';

export const convertDatabase = (bytes: Uint8Array): DatabaseImportConversion => {
  const { rows, stats } = convertLegacyTracker(Buffer.from(bytes));
  const content = JSON.stringify(rows);
  if (Buffer.byteLength(content) > importLimits.bytes)
    throw new Error('The converted applications exceed 2 MB. Import a smaller JSON or CSV export.');
  const warnings: string[] = [];
  if (stats.assumedUtc)
    warnings.push(`${stats.assumedUtc} dates had no timezone and were read as UTC.`);
  if (stats.derivedTitles)
    warnings.push(
      `${stats.derivedTitles} role titles were derived from folder names. Check them in the preview.`,
    );
  if (stats.clipped)
    warnings.push(
      `${stats.clipped} applications had long text, tags or history shortened to fit import limits.`,
    );
  return { content, warnings };
};
