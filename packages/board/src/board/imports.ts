import {
  applicationImportApply,
  applicationImportRequest,
  assertTransition,
  importLimits,
  normalizeApplicationText,
  parseApplicationImport,
  planImportRow,
  type ApplicationImportReport,
  type ApplicationImportRowResult,
  type Card,
  type ImportPlan,
  type ImportRowStatus,
} from '@pitchcrew/core';
import { createHash } from 'node:crypto';
import type { Board } from '../index.ts';
import { isLikelyDuplicateApplication, recordExternalApplication } from './tracking.ts';

// Imported cards carry a stable per-row key in their import event message, so
// a retried apply skips rows it already created without a new event shape.
const keyMessage = 'Imported a past application (import key ';
type Known = Pick<Card, 'company' | 'title' | 'url' | 'tracking'> & { id?: string; row?: number };

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
function importedKeys(board: Board): Map<string, string> {
  const rows = board.db
    .prepare(
      "SELECT json_extract(json,'$.entityId') AS id, json_extract(json,'$.message') AS message FROM events WHERE json_extract(json,'$.kind') = 'card' AND json_extract(json,'$.message') LIKE ?",
    )
    .all(`${keyMessage}%`) as { id: string; message: string }[];
  return new Map(
    rows.flatMap((row) => {
      const key = /\(import key ([0-9a-f]{24})\)/.exec(row.message)?.[1];
      return key ? [[key, row.id] as const] : [];
    }),
  );
}
function readRequest(data: unknown, apply: boolean) {
  const request = (apply ? applicationImportApply : applicationImportRequest).parse(data);
  if (Buffer.byteLength(request.content) > importLimits.bytes)
    throw new Error(`Import files can be at most ${importLimits.bytes / 1024 / 1024} MB.`);
  const digest = sha256(`${request.format}\n${request.content}`);
  if ('digest' in request && request.digest !== digest)
    throw new Error('The file changed after the preview. Preview it again.');
  return { ...request, digest };
}
function createImported(board: Board, plan: ImportPlan, key: string): Card {
  const message = `${keyMessage}${key})`;
  let card: Card;
  if (plan.start === 'submitted')
    card = recordExternalApplication(
      board,
      plan.input,
      { submittedAt: plan.submittedAt!, jobIdentifier: plan.jobIdentifier, note: plan.note },
      `${message}; registered a known external submission, no outward action`,
    );
  else {
    card = {
      ...board.createCard(plan.input),
      tracking: {
        origin: 'pitchcrew',
        jobIdentifier: plan.jobIdentifier,
        note: plan.note,
        gmailThreads: [],
      },
    };
    board.record('card', card, 'user', `${message}; not submitted`);
  }
  if (!plan.steps.length) {
    card = { ...card, statusEffectiveAt: plan.effectiveAt };
    board.record(
      'card',
      card,
      'user',
      `Imported past status ${card.state} effective ${plan.effectiveAt}`,
    );
  }
  for (const step of plan.steps) {
    assertTransition(card.state, step.state);
    card = {
      ...card,
      state: step.state,
      statusEffectiveAt: step.at,
      updatedAt: new Date().toISOString(),
    };
    board.record(
      'card',
      card,
      'user',
      `Imported past status ${step.state.replaceAll('_', ' ')} effective ${step.at}`,
    );
  }
  return card;
}

function processImport(board: Board, data: unknown, apply: boolean): ApplicationImportReport {
  const { format, content, digest } = readRequest(data, apply);
  const parsed = parseApplicationImport(format, content);
  const now = Date.now();
  // Duplicates always share normalized company and title, so compare within those groups.
  const known = new Map<string, Known[]>();
  const group = (card: Pick<Card, 'company' | 'title'>) =>
    `${normalizeApplicationText(card.company)}\n${normalizeApplicationText(card.title)}`;
  const remember = (card: Known) =>
    known.set(group(card), [...(known.get(group(card)) ?? []), card]);
  for (const card of board.list<Card>('card')) remember(card);
  const imported = importedKeys(board);
  const seen = new Map<string, number>();
  const rows = parsed.map((source): ApplicationImportRowResult => {
    const result: ApplicationImportRowResult = {
      row: source.row,
      key: '',
      company: source.company,
      title: source.title,
      sourceState: source.state,
      state: null,
      path: [],
      status: 'invalid',
      reason: source.error ?? '',
      cardIds: [],
      warnings: [],
    };
    if (!source.data) return result;
    let plan: ImportPlan;
    try {
      plan = planImportRow(source.data, now);
    } catch (error) {
      return { ...result, reason: error instanceof Error ? error.message : 'Invalid row.' };
    }
    const key = sha256(JSON.stringify(source.data)).slice(0, 24);
    Object.assign(result, {
      key,
      company: plan.input.company,
      title: plan.input.title,
      state: plan.state,
      path: [plan.start, ...plan.steps.map((step) => step.state)],
      warnings: plan.warnings,
    });
    const repeated = seen.get(key);
    if (repeated) return { ...result, status: 'duplicate', reason: `Same as row ${repeated}.` };
    seen.set(key, source.row);
    const existing = imported.get(key);
    if (existing)
      return {
        ...result,
        status: 'imported',
        reason: 'Already imported.',
        cardIds: [existing],
      };
    const identity = { ...plan.input, jobIdentifier: plan.jobIdentifier };
    const duplicates = (known.get(group(identity)) ?? []).filter((card) =>
      isLikelyDuplicateApplication(card, identity),
    );
    if (duplicates.length) {
      const planned = duplicates.find((card) => card.row);
      return {
        ...result,
        status: 'duplicate',
        reason: planned
          ? `Same application as row ${planned.row}.`
          : 'Matches an application already on the board.',
        cardIds: duplicates.flatMap((card) => (card.id ? [card.id] : [])),
      };
    }
    if (!apply) {
      remember({
        ...plan.input,
        tracking: { origin: 'external', jobIdentifier: plan.jobIdentifier, gmailThreads: [] },
        row: source.row,
      });
      return { ...result, status: 'new' };
    }
    try {
      // Each row commits on its own so one failure does not block the others.
      const card = board.db.transaction(() => createImported(board, plan, key))();
      remember({ ...card, row: source.row });
      imported.set(key, card.id);
      return { ...result, status: 'created', cardIds: [card.id] };
    } catch (error) {
      return {
        ...result,
        status: 'failed',
        reason: error instanceof Error ? error.message : 'Import failed.',
      };
    }
  });
  const counts = Object.fromEntries(
    (['new', 'created', 'imported', 'duplicate', 'invalid', 'failed'] as ImportRowStatus[]).map(
      (status) => [status, rows.filter((row) => row.status === status).length],
    ),
  ) as Record<ImportRowStatus, number>;
  return { digest, rows, counts };
}
/** Parses and checks every row without changing the board. */
export function previewApplicationImport(board: Board, data: unknown): ApplicationImportReport {
  return processImport(board, data, false);
}
/** Applies the previewed file. Rows already imported or likely duplicates are skipped. */
export function applyApplicationImport(board: Board, data: unknown): ApplicationImportReport {
  return processImport(board, data, true);
}
