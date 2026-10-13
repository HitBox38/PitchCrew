// Converts a legacy SQLite application tracker into a Pitchcrew import file.
// Usage: node scripts/convert-legacy-tracker.ts <tracker.db> [applications.json]
// The tracker is opened read-only. Without an output path, JSON goes to stdout.
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Share the same typed converter as the user-facing database import.
import { convertLegacyTracker } from '../packages/board/src/board/legacy-tracker.ts';
export {
  convertLegacyTracker,
  normalizeTime,
  titleFromFolder,
} from '../packages/board/src/board/legacy-tracker.ts';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input) {
    console.error('Usage: node scripts/convert-legacy-tracker.ts <tracker.db> [output.json]');
    process.exit(2);
  }
  const { rows, stats } = convertLegacyTracker(input);
  const json = `${JSON.stringify(rows, null, 2)}\n`;
  if (output) await writeFile(output, json, { flag: 'wx' });
  else process.stdout.write(json);
  console.error(
    [
      `Converted ${stats.applications} applications${output ? ` to ${output}` : ''}.`,
      stats.derivedTitles ? `${stats.derivedTitles} titles came from folder paths.` : '',
      stats.assumedUtc ? `${stats.assumedUtc} times had no timezone and were read as UTC.` : '',
      stats.clipped ? `${stats.clipped} applications had long text or history shortened.` : '',
      'Review the preview in Pitchcrew before importing.',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}
