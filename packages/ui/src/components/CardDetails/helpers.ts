import type { Card, Run, Snapshot } from '@pitchcrew/core';
import { workflowSeat } from '@pitchcrew/core/states';
import type { JobAgent } from './types.ts';

/** Stream activity overrides persisted activity without losing run identity. */
export const jobAgents = (cardId: string, data: Snapshot): JobAgent[] => {
  const runs = new Map(data.runs.map((run) => [run.id, run]));
  for (const run of data.activityRuns ?? []) runs.set(run.id, { ...runs.get(run.id), ...run });
  return [...runs.values()]
    .filter(
      (run) =>
        run.cardId === cardId &&
        ['running', 'waiting'].includes(run.status) &&
        !run.reviewSeatReservation,
    )
    .filter(
      (run, _, all) =>
        !all.some(
          (other) =>
            other.rootRunId === run.id && other.id !== run.id && other.status === 'running',
        ),
    )
    .filter(
      (run, _, all) =>
        run.status === 'running' ||
        !all.some((other) => other.roleId === run.roleId && other.status === 'running'),
    )
    .map((run) => ({
      run,
      name: data.roles.find((role) => role.id === run.roleId)?.name ?? run.roleId,
    }));
};
export const turnPreview = (run: Run) => {
  const commentary = run.activity?.findLast(
    (entry) => entry.kind === 'commentary' && entry.text?.trim(),
  );
  const step = run.activity?.findLast(
    (entry) => entry.status === 'running' && entry.kind !== 'commentary',
  );
  return {
    status:
      run.status === 'waiting' ? 'Waiting for you' : (step?.label ?? run.message ?? 'Working…'),
    commentary: commentary?.text,
  };
};
export const jobRole = (data: Snapshot, seat: 'scout' | 'writer' | 'reviewer') => {
  return data.roles.find((role) => role.enabled && !role.retiredAt && workflowSeat(role) === seat);
};
export const launchBlocker = (data: Snapshot, roleId: string | undefined) => {
  const role = data.roles.find((role) => role.id === roleId);
  if (!role?.enabled || role.retiredAt) return 'Enable an application agent in Crew.';
  if (!['demo', 'codex', 'claude-code', 'opencode'].includes(role.runtime))
    return 'Choose an isolated application runtime in Crew.';
  if (!data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available))
    return 'Install this agent’s runtime in Settings.';
  if (!data.profile.some((note) => note.content.trim()))
    return 'Add your profile notes before starting the crew.';
  return null;
};
export const packetNeedsReview = (card: Card) => {
  return Boolean(
    card.packet &&
    (!card.packetReview || card.packetReview.contextRevision !== card.applicationContext?.revision),
  );
};

/** A later successful run clears an earlier failure from the persistent footer. */
export const latestJobFailure = (cardId: string, runs: Run[]) => {
  const latest = runs.reduce<Run | undefined>((current, run) => {
    if (run.cardId !== cardId || run.reviewSeatReservation) return current;
    return !current || (run.finishedAt ?? run.startedAt) > (current.finishedAt ?? current.startedAt)
      ? run
      : current;
  }, undefined);
  return latest?.status === 'failed' ? latest : undefined;
};
