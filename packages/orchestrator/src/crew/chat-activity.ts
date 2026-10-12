import type { Run, RuntimeActivity } from '@pitchcrew/core';
import type { CrewContext } from './types.ts';

const entryLimit = 80;
const textLimit = 4000;

export function activityRuns(context: CrewContext, includeSaved = false): Run[] {
  const runs = includeSaved
    ? context.board.list<Run>('run').filter((run) => run.mode === 'chat')
    : [...context.runActivities.keys()].map((id) => context.board.get<Run>('run', id));
  return runs.map((run) => {
    const live = context.runActivities.get(run.id);
    // Skill/instruction snapshots already belong to workspace history, not each live frame.
    const { configuration: _configuration, ...visible } = run;
    return {
      ...visible,
      ...(live ? { activity: live.entries, activityTruncated: live.truncated } : {}),
    };
  });
}

export function recordChatActivity(context: CrewContext, runId: string, update: RuntimeActivity) {
  const run = context.board.get<Run>('run', runId);
  if (
    run.mode !== 'chat' ||
    run.status !== 'running' ||
    context.closing ||
    context.controllers.get(runId)?.signal.aborted
  )
    return;
  const state = context.runActivities.get(runId) ?? { entries: [], truncated: false };
  const id = update.id.slice(0, 160);
  const existing = state.entries.find((entry) => entry.id === id);
  if (!existing && state.entries.length >= entryLimit) {
    const changed = !state.truncated;
    state.truncated = true;
    context.runActivities.set(runId, state);
    if (changed) context.publishChat();
    return;
  }
  const now = new Date().toISOString();
  const entry = {
    id,
    kind: update.kind,
    status: update.status,
    label: update.label.slice(0, 160),
    text: update.kind === 'commentary' ? update.text?.slice(0, textLimit) : undefined,
    startedAt: existing?.startedAt ?? now,
    finishedAt: update.status === 'running' ? null : (existing?.finishedAt ?? now),
  };
  state.entries = existing
    ? state.entries.map((current) => (current === existing ? entry : current))
    : [...state.entries, entry];
  context.runActivities.set(runId, state);
  context.publishChat();
}

export function finishChatActivity(context: CrewContext, runId: string) {
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
  context.publishChat(true);
}
