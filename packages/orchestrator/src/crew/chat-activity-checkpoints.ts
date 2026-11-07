import { z } from 'zod';
import type { CrewContext } from './types.ts';

const checkpointSchema = z.object({
  entries: z
    .array(
      z.object({
        id: z.string().max(160),
        kind: z.enum(['commentary', 'tool', 'reasoning']),
        label: z.string().max(160),
        text: z.string().max(4000).optional(),
        status: z.enum(['running', 'completed', 'failed', 'interrupted']),
        startedAt: z.string().datetime(),
        finishedAt: z.string().datetime().nullable(),
      }),
    )
    .max(80),
  truncated: z.boolean(),
});
const interval = 10_000;
const initialized = new WeakSet<CrewContext['board']>();
const pending = new WeakMap<
  CrewContext,
  Map<string, { savedAt: number; timer?: ReturnType<typeof setTimeout> }>
>();

const initialize = (context: CrewContext) => {
  if (initialized.has(context.board)) return;
  context.board.db.exec(`CREATE TABLE IF NOT EXISTS run_activity_checkpoints (
    run_id TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL
  )`);
  initialized.add(context.board);
};

/** Replace one bounded row, never append full run events for streaming updates. */
export const checkpointActivity = (context: CrewContext, runId: string) => {
  initialize(context);
  let runs = pending.get(context);
  if (!runs) pending.set(context, (runs = new Map()));
  let state = runs.get(runId);
  const save = () => {
    state!.timer = undefined;
    state!.savedAt = Date.now();
    const activity = context.runActivities.get(runId);
    if (!activity) return;
    try {
      const checkpoint = checkpointSchema.parse(activity);
      // Only commentary is public prose. Discard other text even on restored rows.
      for (const entry of checkpoint.entries) if (entry.kind !== 'commentary') delete entry.text;
      context.board.db
        .prepare('INSERT OR REPLACE INTO run_activity_checkpoints (run_id,json) VALUES (?,?)')
        .run(runId, JSON.stringify(checkpoint));
    } catch {
      // Activity is advisory; a failed checkpoint must not abort the provider or timer loop.
    }
  };
  if (!state) {
    state = { savedAt: 0 };
    runs.set(runId, state);
    save();
    return;
  }
  if (state.timer) return;
  const remaining = interval - (Date.now() - state.savedAt);
  if (remaining <= 0) save();
  else {
    state.timer = setTimeout(save, remaining);
    state.timer.unref();
  }
};

export const clearActivityCheckpoint = (context: CrewContext, runId: string) => {
  const runs = pending.get(context);
  clearTimeout(runs?.get(runId)?.timer);
  runs?.delete(runId);
  if (initialized.has(context.board))
    context.board.db.prepare('DELETE FROM run_activity_checkpoints WHERE run_id=?').run(runId);
};

/** Recovery uses only public activity; existing lifecycle code decides the run's outcome. */
export const restoreActivityCheckpoints = (context: CrewContext) => {
  initialize(context);
  context.board.db.exec(`DELETE FROM run_activity_checkpoints WHERE NOT EXISTS (
    SELECT 1 FROM entities WHERE kind='run' AND id=run_id
      AND (json_extract(entities.json,'$.status')='running'
        OR json_type(entities.json,'$.activity') IS NULL)
  )`);
  const terminal: string[] = [];
  const rows = context.board.db
    .prepare(`SELECT c.run_id, c.json,
    json_extract(e.json,'$.status') AS status
    FROM run_activity_checkpoints c CROSS JOIN entities e ON e.kind='run' AND e.id=c.run_id`)
    .all() as {
    run_id: string;
    json: string;
    status: string;
  }[];
  const discard = context.board.db.prepare('DELETE FROM run_activity_checkpoints WHERE run_id=?');
  for (const row of rows) {
    try {
      if (row.json.length > 2_500_000) throw new Error('Oversized activity checkpoint.');
      const checkpoint = checkpointSchema.parse(JSON.parse(row.json));
      for (const entry of checkpoint.entries) if (entry.kind !== 'commentary') delete entry.text;
      context.runActivities.set(row.run_id, checkpoint);
      // A crash can occur after saving the outcome but before finishChatActivity.
      // Retain that outcome and complete only the missing activity handoff.
      if (row.status !== 'running') terminal.push(row.run_id);
    } catch {
      // A corrupt optional checkpoint never prevents ordinary run recovery.
      discard.run(row.run_id);
    }
  }
  return terminal;
};
