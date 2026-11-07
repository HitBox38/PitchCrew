import { compactRun, type Run, type RuntimeActivity } from '@pitchcrew/core';
import type { CrewContext } from './types.ts';
import {
  checkpointActivity,
  clearActivityCheckpoint,
  restoreActivityCheckpoints,
} from './chat-activity-checkpoints.ts';

export { restoreActivityCheckpoints };

// A bounded tail of evicted active steps preserves their observed start if completion arrives late.
// Finished runs release these timestamps; this is not another persisted activity history.
const evictedStarts = new WeakMap<CrewContext, Map<string, Map<string, string>>>();
const rememberEvictedStart = (
  context: CrewContext,
  runId: string,
  id: string,
  startedAt: string,
) => {
  let runs = evictedStarts.get(context);
  if (!runs) evictedStarts.set(context, (runs = new Map()));
  let entries = runs.get(runId);
  if (!entries) runs.set(runId, (entries = new Map()));
  entries.delete(id);
  entries.set(id, startedAt);
  if (entries.size > entryLimit) entries.delete(entries.keys().next().value!);
};

export const activityRuns = (context: CrewContext, includeSaved = false): Run[] => {
  const runs = includeSaved
    ? context.board.list<Run>('run').filter((run) => !!run.threadId && !run.reviewSeatReservation)
    : [...context.runActivities.keys()].map((id) => context.board.get<Run>('run', id));
  return runs.map((run) => {
    const live = context.runActivities.get(run.id);
    // Skill/instruction snapshots stay out of live frames; only the effective model remains.
    return {
      ...compactRun(run),
      ...(live ? { activity: live.entries, activityTruncated: live.truncated } : {}),
    };
  });
};

export const recordChatActivity = (
  context: CrewContext,
  runId: string,
  update: RuntimeActivity,
) => {
  const run = context.board.get<Run>('run', runId);
  if (
    !run.threadId ||
    run.reviewSeatReservation ||
    run.status !== 'running' ||
    context.closing ||
    context.controllers.get(runId)?.signal.aborted
  )
    return;
  const state = context.runActivities.get(runId) ?? { entries: [], truncated: false };
  const id = update.id.slice(0, 160);
  const existing = state.entries.find((entry) => entry.id === id);
  const forgotten = evictedStarts.get(context)?.get(runId);
  const observedStart = forgotten?.get(id);
  forgotten?.delete(id);
  if (!existing && state.entries.length >= entryLimit) {
    state.truncated = true;
    // Successful work yields before failures, interruptions or still-active steps.
    // If the entire window is active, its oldest step yields to the current one.
    const completed = state.entries.findIndex((entry) => entry.status === 'completed');
    const settled = state.entries.findIndex((entry) => entry.status !== 'running');
    const [evicted] = state.entries.splice(
      completed !== -1 ? completed : settled !== -1 ? settled : 0,
      1,
    );
    if (evicted!.status === 'running')
      rememberEvictedStart(context, runId, evicted!.id, evicted!.startedAt);
  }
  const now = new Date().toISOString();
  const entry = {
    id,
    kind: update.kind,
    status: update.status,
    label: update.label.slice(0, 160),
    text: update.kind === 'commentary' ? update.text?.slice(0, textLimit) : undefined,
    startedAt: existing?.startedAt ?? observedStart ?? now,
    finishedAt: update.status === 'running' ? null : (existing?.finishedAt ?? now),
  };
  state.entries = existing
    ? state.entries.map((current) => (current === existing ? entry : current))
    : [...state.entries, entry];
  context.runActivities.set(runId, state);
  checkpointActivity(context, runId);
  context.publishChat();
};

export const finishChatActivity = (context: CrewContext, runId: string) => {
  const state = context.runActivities.get(runId);
  if (state) {
    const run = context.board.get<Run>('run', runId);
    const now = new Date().toISOString();
    const activity = state.entries.map((entry) =>
      entry.status === 'running'
        ? { ...entry, status: 'interrupted' as const, finishedAt: now }
        : entry,
    );
    context.board.record(
      'run',
      { ...run, activity, activityTruncated: state.truncated },
      run.roleId,
      'Saved turn activity',
    );
    context.runActivities.delete(runId);
  }
  clearActivityCheckpoint(context, runId);
  evictedStarts.get(context)?.delete(runId);
  context.publishChat(true);
};

const entryLimit = 80;
const textLimit = 4000;
