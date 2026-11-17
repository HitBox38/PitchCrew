import {
  activityLimits,
  activityLine,
  compactRun,
  isActivityToolKind,
  isReviewedMcpTool,
  type ActivityToolKind,
  type Run,
  type RunActivity,
  type RuntimeActivity,
  type RuntimeToolFailure,
  type ToolFailureObservation,
} from '@pitchcrew/core';
import type { CrewContext } from './types.ts';
import {
  checkpointActivity,
  clearActivityCheckpoint,
  restoreActivityCheckpoints,
} from './chat-activity-checkpoints.ts';
import { recordToolFailure } from '../telemetry/tool-failures.ts';

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
  if (entries.size > activityLimits.entries) entries.delete(entries.keys().next().value!);
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

/**
 * A tool step's kind and detail carry over from its earlier updates; its reason lasts only while
 * it has failed. Callers already clean these, but this is the last stop before events,
 * checkpoints and the stream, so they are bounded and redacted again.
 */
const toolFields = (update: RuntimeActivity, existing: RunActivity | undefined) => {
  const tool = isActivityToolKind(update.tool) ? update.tool : existing?.tool;
  const detail = activityLine(update.detail, activityLimits.detail) ?? existing?.detail;
  const error =
    update.status === 'failed'
      ? (activityLine(update.error, activityLimits.error) ?? existing?.error)
      : undefined;
  return { ...(tool ? { tool } : {}), ...(detail ? { detail } : {}), ...(error ? { error } : {}) };
};

/** Records a step update; returns the step as saved, or nothing when the turn no longer takes it. */
export const recordChatActivity = (
  context: CrewContext,
  runId: string,
  update: RuntimeActivity,
  { latest = false }: { latest?: boolean } = {},
): RunActivity | undefined => {
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
  const id = update.id.slice(0, activityLimits.id);
  const existing = state.entries.find((entry) => entry.id === id);
  const forgotten = evictedStarts.get(context)?.get(runId);
  const observedStart = forgotten?.get(id);
  forgotten?.delete(id);
  if (!existing && state.entries.length >= activityLimits.entries) {
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
  // Rebuilt field by field: anything else an update carries (a transient failure) is dropped.
  const entry: RunActivity = {
    id,
    kind: update.kind,
    status: update.status,
    label: update.label.slice(0, activityLimits.label),
    text: update.kind === 'commentary' ? update.text?.slice(0, activityLimits.text) : undefined,
    ...(update.kind === 'tool' ? toolFields(update, existing) : {}),
    startedAt: existing?.startedAt ?? observedStart ?? now,
    finishedAt: update.status === 'running' ? null : (existing?.finishedAt ?? now),
  };
  // A row an earlier step started, continued now (an approved browser action carried out after
  // other calls), moves to the latest position: "latest step" readers follow position.
  state.entries =
    existing && !latest
      ? state.entries.map((current) => (current === existing ? entry : current))
      : [...state.entries.filter((current) => current !== existing), entry];
  context.runActivities.set(runId, state);
  checkpointActivity(context, runId);
  context.publishChat();
  return entry;
};

/**
 * A runtime's own failed tool call in closed words: the reason with the reviewed tool name (a
 * Pitchcrew call that never reached the daemon), or with only the call's kind.
 */
const runtimeFailure = (
  failure: RuntimeToolFailure,
  kind: ActivityToolKind,
): ToolFailureObservation =>
  isReviewedMcpTool(failure.tool)
    ? {
        error_source: 'tool_call',
        error_category: failure.reason,
        error_tool: failure.tool,
        error_boundary: 'runtime',
      }
    : { error_source: 'runtime_tool', error_category: failure.reason, error_tool_kind: kind };

/**
 * A runtime's activity callback. Records the step and, when the turn shows one of the runtime's
 * own tool calls as failed, reports it in closed words. The run token finds the capability that
 * bounds and groups the run's reports.
 */
export const recordRuntimeActivity = (
  context: CrewContext,
  runId: string,
  token: string,
  { failure, ...update }: RuntimeActivity,
) => {
  const step = recordChatActivity(context, runId, update);
  const capability = context.capabilities.get(token);
  if (step?.status !== 'failed' || !failure || !capability) return;
  recordToolFailure(context, capability, runtimeFailure(failure, step.tool ?? 'other'));
};

/**
 * A runtime's failed tool call in a run that shows no steps (a workflow run): reported in closed
 * words only while a turn would still record a step, and never recorded, shown or saved itself.
 */
export const reportRuntimeFailure = (
  context: CrewContext,
  runId: string,
  token: string,
  failure: RuntimeToolFailure & { kind: ActivityToolKind },
) => {
  try {
    const capability = context.capabilities.get(token);
    if (context.closing || !capability || context.controllers.get(runId)?.signal.aborted) return;
    const run = context.board.get<Run>('run', runId);
    if (run.status !== 'running' || run.reviewSeatReservation) return;
    const kind = isActivityToolKind(failure.kind) ? failure.kind : 'other';
    recordToolFailure(context, capability, runtimeFailure(failure, kind));
  } catch {
    // Diagnostics must never change a run; a run that is gone reports nothing.
  }
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
