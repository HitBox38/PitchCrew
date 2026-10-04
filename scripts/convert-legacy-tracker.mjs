// Converts a legacy SQLite application tracker into a Pitchcrew import file.
// Usage: node scripts/convert-legacy-tracker.mjs <tracker.db> [applications.json]
// The tracker is opened read-only. Without an output path, JSON goes to stdout.
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// better-sqlite3 is a board package dependency rather than a root one.
const require = createRequire(new URL('../packages/board/package.json', import.meta.url));
const Database = require('better-sqlite3');

const limits = { notes: 4000, lessons: 2000, historyNote: 1000, history: 100 };
const clip = (value, max) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

export function normalizeTime(value, stats) {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  let iso = text.replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T');
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(iso)) {
    // SQLite CURRENT_TIMESTAMP values are UTC without an offset.
    iso += 'Z';
    stats.assumedUtc += 1;
  }
  const time = Date.parse(iso);
  return Number.isNaN(time) ? text : new Date(time).toISOString();
}
export function titleFromFolder(folder, company) {
  const segments = String(folder)
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(
      (segment) =>
        segment &&
        !/^(attempt|try)[-_ ]?\d+$/i.test(segment) &&
        !/^\d+$/.test(segment) &&
        slug(segment) !== slug(company),
    );
  const last = segments.at(-1) ?? '';
  const title = last.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (title.charAt(0).toUpperCase() + title.slice(1)).slice(0, 160);
}
export function convertLegacyTracker(file) {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  const stats = { applications: 0, derivedTitles: 0, assumedUtc: 0, clipped: 0 };
  try {
    const applications = db.prepare('SELECT * FROM applications ORDER BY id').all();
    const events = db.prepare(
      'SELECT to_status, note, created_at FROM status_events WHERE application_id = ? ORDER BY created_at, id',
    );
    const tags = db.prepare(
      'SELECT t.name FROM tags t JOIN application_tags a ON a.tag_id = t.id WHERE a.application_id = ? ORDER BY t.name',
    );
    const rows = applications.map((application) => {
      stats.applications += 1;
      const row = { company: application.company.trim() };
      let title = application.role_title.trim();
      if (!title) {
        title = titleFromFolder(application.folder_path, application.company);
        if (title) {
          row.titleDerived = true;
          stats.derivedTitles += 1;
        }
      }
      row.title = title;
      if (application.attempt > 1) row.attempt = application.attempt;
      row.state = application.status;
      const submittedAt = normalizeTime(application.applied_at, stats);
      if (submittedAt) row.submittedAt = submittedAt;
      if (!['draft', 'ready'].includes(application.status))
        row.statusAt = normalizeTime(application.updated_at, stats);
      const history = events.all(application.id);
      if (history.length > limits.history) stats.clipped += 1;
      row.history = history.slice(-limits.history).map((event) => {
        const entry = { state: event.to_status, at: normalizeTime(event.created_at, stats) };
        const note = (event.note ?? '').trim();
        if (note) entry.note = clip(note, limits.historyNote);
        return entry;
      });
      row.tags = tags.all(application.id).map((tag) => tag.name);
      const notes = (application.notes ?? '').trim();
      if (notes) row.notes = clip(notes, limits.notes);
      if (application.weight) row.weight = application.weight;
      const lessons = (application.lessons_learned ?? '').trim();
      if (lessons) row.lessons = clip(lessons, limits.lessons);
      if (notes.length > limits.notes || lessons.length > limits.lessons) stats.clipped += 1;
      return row;
    });
    return { rows, stats };
  } finally {
    db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input) {
    console.error('Usage: node scripts/convert-legacy-tracker.mjs <tracker.db> [output.json]');
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
