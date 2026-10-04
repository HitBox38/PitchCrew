import { z } from 'zod';
import { cardInput, type CardInput } from './cards.ts';
import { transitions, type CardState } from './states.ts';
import { canonicalJobUrl } from './tracking.ts';
import { lessonLimits } from './insights.ts';

// Bulk import of applications tracked before Pitchcrew. Parsing and state
// planning are pure; the board module checks duplicates and applies rows.
export const importLimits = {
  rows: 1000,
  bytes: 2 * 1024 * 1024,
  history: 100,
  note: 6000,
  tags: 10,
  tagLength: 40,
} as const;
export const importStates = [
  'lead',
  'shortlisted',
  'draft',
  'ready',
  'submitted',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
  'ghosted',
] as const;
export type ImportState = (typeof importStates)[number];
export const importColumns = [
  'company',
  'title',
  'titleDerived',
  'attempt',
  'location',
  'url',
  'jobIdentifier',
  'state',
  'submittedAt',
  'statusAt',
  'history',
  'tags',
  'notes',
  'weight',
  'lessons',
] as const;
const importTime = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const text = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
    if (!z.iso.datetime({ offset: true }).safeParse(text).success) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Use a date (2025-03-01) or a date and time with a timezone (2025-03-01T09:00:00Z).',
      });
      return z.NEVER;
    }
    return new Date(text).toISOString();
  });
export const importHistoryEntry = z
  .object({
    state: z.enum(importStates),
    at: importTime,
    note: z.string().trim().max(1000).default(''),
  })
  .strict();
export const applicationImportRow = z
  .object({
    company: z.string().trim().min(1).max(100),
    title: z.string().trim().max(160).default(''),
    titleDerived: z.boolean().default(false),
    attempt: z.number().int().min(1).max(99).default(1),
    location: z.string().trim().max(120).default(''),
    url: z
      .string()
      .trim()
      .max(2000)
      .default('')
      .refine(
        (value) => !value || (/^https?:\/\//i.test(value) && !!canonicalJobUrl(value)),
        'Use an HTTP or HTTPS URL.',
      ),
    jobIdentifier: z.string().trim().max(200).default(''),
    state: z.enum(importStates),
    submittedAt: importTime.optional(),
    statusAt: importTime.optional(),
    history: z.array(importHistoryEntry).max(importLimits.history).default([]),
    tags: z.array(z.string().max(200)).max(100).default([]),
    notes: z.string().trim().max(4000).default(''),
    weight: z.number().int().min(-2).max(2).optional(),
    lessons: z.string().trim().max(2000).default(''),
  })
  .strict();
export type ApplicationImportRow = z.infer<typeof applicationImportRow>;
export const applicationImportRequest = z
  .object({ format: z.enum(['json', 'csv']), content: z.string().min(1) })
  .strict();
export const applicationImportApply = applicationImportRequest
  .extend({ digest: z.string().regex(/^[0-9a-f]{64}$/) })
  .strict();
export type ImportRowStatus = 'new' | 'created' | 'imported' | 'duplicate' | 'invalid' | 'failed';
export interface ApplicationImportRowResult {
  row: number;
  key: string;
  company: string;
  title: string;
  sourceState: string;
  state: CardState | null;
  path: CardState[];
  status: ImportRowStatus;
  reason: string;
  cardIds: string[];
  warnings: string[];
}
export interface ApplicationImportReport {
  digest: string;
  rows: ApplicationImportRowResult[];
  counts: Record<ImportRowStatus, number>;
}
export interface ParsedImportRow {
  row: number;
  data?: ApplicationImportRow;
  error?: string;
  company: string;
  title: string;
  state: string;
}

export function parseApplicationImport(format: 'json' | 'csv', content: string): ParsedImportRow[] {
  const raw = format === 'json' ? jsonRows(content) : csvRows(content);
  if (!raw.length) throw new Error('The file has no applications.');
  if (raw.length > importLimits.rows)
    throw new Error(`Import at most ${importLimits.rows} applications at a time.`);
  return raw.map(({ row, value, error }) => {
    const record = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const text = (key: string) => (typeof record[key] === 'string' ? (record[key] as string) : '');
    const base = { row, company: text('company'), title: text('title'), state: text('state') };
    if (error) return { ...base, error };
    const parsed = applicationImportRow.safeParse(value);
    if (parsed.success) return { ...base, data: parsed.data };
    return {
      ...base,
      error: parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'row'}: ${issue.message}`)
        .join('; '),
    };
  });
}
interface RawRow {
  row: number;
  value: unknown;
  error?: string;
}
function jsonRows(content: string): RawRow[] {
  let value: unknown;
  try {
    value = JSON.parse(content.replace(/^﻿/, ''));
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if (!Array.isArray(value)) throw new Error('A JSON import must be an array of applications.');
  return value.map((item, index) => ({ row: index + 1, value: item }));
}
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const text = content.replace(/^﻿/, '');
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('The CSV file has an unclosed quoted value.');
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((value) => value.some((cell) => cell.trim() !== ''));
}
function csvRows(content: string): RawRow[] {
  const [header, ...lines] = parseCsv(content);
  if (!header) return [];
  const columns = header.map((name) => {
    const column = importColumns.find((value) => value.toLowerCase() === name.trim().toLowerCase());
    if (!column) throw new Error(`Unknown CSV column: ${name.trim() || '(blank)'}.`);
    return column;
  });
  for (const required of ['company', 'state'] as const)
    if (!columns.includes(required)) throw new Error(`The CSV file needs a ${required} column.`);
  if (new Set(columns).size !== columns.length) throw new Error('A CSV column is repeated.');
  return lines.map((cells, index) => {
    const value: Record<string, unknown> = {};
    if (cells.length > columns.length)
      return {
        row: index + 1,
        value,
        error: `row: Has ${cells.length} values but the header has ${columns.length} columns.`,
      };
    columns.forEach((column, position) => {
      const cell = (cells[position] ?? '').trim();
      if (!cell) return;
      if (column === 'attempt' || column === 'weight')
        value[column] = /^-?\d+$/.test(cell) ? Number(cell) : cell;
      else if (column === 'titleDerived') value[column] = /^(true|yes|1)$/i.test(cell);
      else if (column === 'tags') value[column] = cell.split(';').map((tag) => tag.trim());
      else if (column === 'history')
        value[column] = cell
          .split(';')
          .filter((entry) => entry.trim())
          .map((entry) => {
            const [state = '', ...at] = entry.trim().split('@');
            return { state: state.trim(), at: at.join('@').trim() };
          });
      else value[column] = cell;
    });
    return { row: index + 1, value };
  });
}

const submittedStates = new Set<CardState>([
  'submitted',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'ghosted',
]);
export function importCardState(state: ImportState): CardState {
  return state === 'draft' || state === 'ready' ? 'lead' : state;
}
export interface ImportPlan {
  input: CardInput;
  jobIdentifier: string;
  submittedAt: string | null;
  start: 'lead' | 'submitted';
  effectiveAt: string;
  steps: { state: CardState; at: string }[];
  state: CardState;
  note: string;
  warnings: string[];
  weight?: number;
  lessons: string[];
}
// Split by Unicode code point so neither note contains half of a surrogate pair.
function importedLessons(text: string): string[] {
  const notes: string[] = [];
  let note = '';
  for (const character of text) {
    if (note.length + character.length > lessonLimits.length) {
      notes.push(note.trim());
      note = '';
    }
    note += character;
  }
  if (note) notes.push(note.trim());
  return notes.filter(Boolean);
}
function shortestPath(from: CardState, to: CardState, allowed: Set<CardState>): CardState[] {
  const previous = new Map<CardState, CardState | null>([[from, null]]);
  const queue: CardState[] = [from];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === to) break;
    for (const next of transitions[current])
      if (allowed.has(next) && !previous.has(next)) {
        previous.set(next, current);
        queue.push(next);
      }
  }
  if (!previous.has(to)) throw new Error(`No valid status path from ${from} to ${to}.`);
  const path: CardState[] = [];
  for (let state: CardState | null = to; state && state !== from; state = previous.get(state)!)
    path.unshift(state);
  return path;
}
export function planImportRow(row: ApplicationImportRow, now: number = Date.now()): ImportPlan {
  const warnings: string[] = [];
  const state = importCardState(row.state);
  const history = row.history.map((entry) => ({ ...entry, state: importCardState(entry.state) }));
  const times = [row.submittedAt, row.statusAt, ...history.map((entry) => entry.at)];
  if (times.some((time) => time && Date.parse(time) > now))
    throw new Error('Dates cannot be in the future.');
  const reached =
    !!row.submittedAt ||
    submittedStates.has(state) ||
    history.some((entry) => submittedStates.has(entry.state));
  if (reached && (state === 'lead' || state === 'shortlisted'))
    throw new Error(
      `State ${row.state} comes before submission, but the row has a submission time or submitted history.`,
    );
  let submittedAt = row.submittedAt ?? null;
  if (reached && !submittedAt) {
    submittedAt =
      history.find((entry) => entry.state === 'submitted')?.at ??
      history.find((entry) => submittedStates.has(entry.state))?.at ??
      null;
    if (!submittedAt)
      throw new Error('Add submittedAt: this application reached submission but has no date.');
    warnings.push('Used the first submitted history date as the submission time.');
  }
  const start = reached ? 'submitted' : 'lead';
  const allowed = new Set<CardState>(
    reached
      ? ['submitted', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn', 'ghosted']
      : ['lead', 'shortlisted', 'withdrawn'],
  );
  const sequence: typeof history = [];
  for (const entry of history)
    if (allowed.has(entry.state) && entry.state !== start && sequence.at(-1)?.state !== entry.state)
      sequence.push(entry);
  const chain = sequence.every((entry, index) =>
    transitions[index ? sequence[index - 1].state : start].includes(entry.state),
  );
  // Follow valid legacy history, completing it to the final state when needed.
  // Otherwise take the shortest valid path and keep the original text.
  let planned: { state: CardState; at?: string }[] | null = null;
  if (chain)
    try {
      planned = [
        ...sequence,
        ...shortestPath(sequence.at(-1)?.state ?? start, state, allowed).map((next) => ({
          state: next,
        })),
      ];
    } catch {
      planned = null;
    }
  const fitted = !!planned;
  if (!planned) planned = shortestPath(start, state, allowed).map((next) => ({ state: next }));
  let previous = submittedAt;
  let clamped = false;
  const added: CardState[] = [];
  const steps = planned.map((step, index) => {
    const final = index === planned.length - 1;
    let time =
      step.at ??
      history.find(
        (entry) =>
          entry.state === step.state && (!previous || Date.parse(entry.at) >= Date.parse(previous)),
      )?.at;
    if (!time && !final) added.push(step.state);
    time ??= final ? row.statusAt : undefined;
    if (!time) {
      if (final)
        warnings.push(
          `No date for ${step.state}; used ${previous ? 'the date of the step before' : 'the import time'}.`,
        );
      time = previous ?? new Date(now).toISOString();
    } else if (previous && Date.parse(time) < Date.parse(previous)) {
      clamped = true;
      time = previous;
    }
    previous = time;
    return { state: step.state, at: time };
  });
  // A final state that equals the initial state still has a historical date.
  // Persist it explicitly so tracking never substitutes the import event time.
  if (!steps.length) {
    const dated = history.findLast((entry) => entry.state === state)?.at ?? row.statusAt;
    if (dated && previous && Date.parse(dated) < Date.parse(previous)) clamped = true;
    previous = dated && (!previous || Date.parse(dated) >= Date.parse(previous)) ? dated : previous;
    if (!previous) {
      previous = new Date(now).toISOString();
      warnings.push(`No date for ${state}; used the import time.`);
    }
  }
  if (!fitted)
    warnings.push(
      'History did not fit the board status steps; used the shortest valid path and kept the original history in the note.',
    );
  if (added.length) warnings.push(`Added ${added.join(', ')} to reach ${state}.`);
  if (clamped)
    warnings.push('Some status dates were earlier than the step before; used that earlier date.');
  if (row.state === 'draft' || row.state === 'ready')
    warnings.push(
      `Legacy ${row.state} becomes a lead; nothing was submitted and no packet is created.`,
    );
  const suffix = row.attempt > 1 ? ` (try ${row.attempt})` : '';
  if (!row.title) warnings.push('Title was empty; used Untitled role.');
  else if (row.titleDerived) warnings.push('Title was derived from the folder path.');
  const title = `${(row.title || 'Untitled role').slice(0, 160 - suffix.length).trim()}${suffix}`;
  const seen = new Set<string>();
  const tags = row.tags
    .map((tag) => tag.trim().slice(0, importLimits.tagLength).trim())
    .filter((tag) => tag && !seen.has(tag.toLowerCase()) && seen.add(tag.toLowerCase()));
  if (row.tags.some((tag) => tag.trim().length > importLimits.tagLength))
    warnings.push(`Shortened tags longer than ${importLimits.tagLength} characters.`);
  if (tags.length > importLimits.tags)
    warnings.push(
      `Kept the first ${importLimits.tags} tags; dropped ${tags.slice(importLimits.tags).join(', ')}.`,
    );
  if (row.weight !== undefined || row.lessons)
    warnings.push(
      'Kept legacy weight and lessons in the card note and saved them as learning signals.',
    );
  const lessons = importedLessons(row.lessons);
  if (lessons.length > 1)
    warnings.push('Split legacy lessons into learning notes of at most 1,000 characters.');
  const lines = ['Imported from a past tracker.'];
  if (row.notes) lines.push('', row.notes);
  if (row.lessons) lines.push('', `Legacy lessons: ${row.lessons}`);
  if (row.weight !== undefined) lines.push('', `Legacy weight: ${row.weight}`);
  if (!fitted || history.some((entry) => entry.note))
    lines.push(
      '',
      'Legacy history:',
      ...row.history.map(
        (entry) => `- ${entry.state} at ${entry.at}${entry.note ? `: ${entry.note}` : ''}`,
      ),
    );
  let note = lines.join('\n');
  if (note.length > importLimits.note) {
    note = `${note.slice(0, importLimits.note - 1)}…`;
    warnings.push(`Shortened the note to ${importLimits.note} characters.`);
  }
  return {
    input: cardInput.parse({
      company: row.company,
      title,
      location: row.location,
      url: row.url,
      tags: tags.slice(0, importLimits.tags),
    }),
    jobIdentifier: row.jobIdentifier,
    submittedAt,
    start,
    effectiveAt: previous!,
    steps,
    state,
    note,
    warnings,
    weight: row.weight,
    lessons,
  };
}
