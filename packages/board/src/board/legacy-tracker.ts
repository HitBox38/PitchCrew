import Database from 'better-sqlite3';
import { importLimits } from '@pitchcrew/core';

export const normalizeTime = (value: unknown, stats: LegacyTrackerStats) => {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  let iso = text.replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T');
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(iso)) {
    iso += 'Z';
    stats.assumedUtc += 1;
  }
  const time = Date.parse(iso);
  return Number.isNaN(time) ? text : new Date(time).toISOString();
};
export const titleFromFolder = (folder: string, company: string) => {
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
  const title = (segments.at(-1) ?? '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (title.charAt(0).toUpperCase() + title.slice(1)).slice(0, 160);
};

/** Read a legacy tracker from a file or an uploaded snapshot; never modify its contents. */
export const convertLegacyTracker = (source: string | Buffer) => {
  const db = new Database(source, { readonly: true, fileMustExist: true });
  const stats: LegacyTrackerStats = {
    applications: 0,
    derivedTitles: 0,
    assumedUtc: 0,
    clipped: 0,
  };
  try {
    db.pragma('query_only = ON');
    db.pragma('trusted_schema = OFF');
    for (const [table, required] of Object.entries(schema)) {
      const kind = db.prepare('SELECT type, sql FROM sqlite_schema WHERE name = ?').get(table) as
        | { type: string; sql: string }
        | undefined;
      const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (
        kind?.type !== 'table' ||
        /^CREATE\s+VIRTUAL/i.test(kind.sql) ||
        required.some((name) => !columns.some((column) => column.name === name))
      )
        throw new Error(
          'This database is not a supported application tracker. Export your applications as JSON or CSV, then choose that file.',
        );
    }
    const applications = db
      .prepare(`SELECT ${schema.applications.join(', ')} FROM applications ORDER BY id LIMIT ?`)
      .all(importLimits.rows + 1) as LegacyApplication[];
    if (applications.length > importLimits.rows)
      throw new Error(`Import at most ${importLimits.rows} applications at a time.`);
    const events = db.prepare(
      'SELECT to_status, note, created_at FROM status_events WHERE application_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
    );
    const tags = db.prepare(
      'SELECT t.name FROM tags t JOIN application_tags a ON a.tag_id = t.id WHERE a.application_id = ? ORDER BY t.name LIMIT 101',
    );
    const rows = applications.map((application) => {
      stats.applications += 1;
      let title = application.role_title.trim();
      let titleDerived = false;
      if (!title) {
        title = titleFromFolder(application.folder_path, application.company);
        if (title) {
          titleDerived = true;
          stats.derivedTitles += 1;
        }
      }
      const history = events.all(application.id, limits.history + 1) as LegacyEvent[];
      const names = tags.all(application.id) as { name: string }[];
      const notes = (application.notes ?? '').trim();
      const lessons = (application.lessons_learned ?? '').trim();
      if (
        history.length > limits.history ||
        names.length > 100 ||
        notes.length > limits.notes ||
        lessons.length > limits.lessons ||
        history.some((event) => (event.note ?? '').trim().length > limits.historyNote)
      )
        stats.clipped += 1;
      return {
        company: application.company.trim(),
        title,
        ...(titleDerived ? { titleDerived } : {}),
        ...(application.attempt > 1 ? { attempt: application.attempt } : {}),
        state: application.status,
        submittedAt: normalizeTime(application.applied_at, stats),
        ...(!['draft', 'ready'].includes(application.status)
          ? { statusAt: normalizeTime(application.updated_at, stats) }
          : {}),
        history: history
          .slice(0, limits.history)
          .reverse()
          .map((event) => ({
            state: event.to_status,
            at: normalizeTime(event.created_at, stats),
            ...((event.note ?? '').trim()
              ? { note: clip(event.note!.trim(), limits.historyNote) }
              : {}),
          })),
        tags: names.slice(0, 100).map((tag) => tag.name),
        ...(notes ? { notes: clip(notes, limits.notes) } : {}),
        ...(application.weight ? { weight: application.weight } : {}),
        ...(lessons ? { lessons: clip(lessons, limits.lessons) } : {}),
      };
    });
    return { rows, stats };
  } finally {
    db.close();
  }
};

export interface LegacyTrackerStats {
  applications: number;
  derivedTitles: number;
  assumedUtc: number;
  clipped: number;
}
interface LegacyApplication {
  id: number;
  company: string;
  role_title: string;
  folder_path: string;
  attempt: number;
  status: string;
  applied_at: string | null;
  updated_at: string;
  notes: string | null;
  weight: number;
  lessons_learned: string | null;
}
interface LegacyEvent {
  to_status: string;
  note: string | null;
  created_at: string;
}
const limits = { notes: 4000, lessons: 2000, historyNote: 1000, history: 100 };
const clip = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
const schema = {
  applications: [
    'id',
    'company',
    'role_title',
    'folder_path',
    'attempt',
    'status',
    'applied_at',
    'updated_at',
    'notes',
    'weight',
    'lessons_learned',
  ],
  status_events: ['id', 'application_id', 'to_status', 'note', 'created_at'],
  tags: ['id', 'name'],
  application_tags: ['application_id', 'tag_id'],
};
