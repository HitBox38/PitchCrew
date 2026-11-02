import type { Card, Run, Snapshot } from '@pitchcrew/core';
import { workflowSeat } from '@pitchcrew/core/states';
import type { ApplicationSection, JobAgent } from './types.ts';

/** Stream activity overrides persisted activity without losing run identity. */
export const jobAgents = (cardId: string, data: Snapshot): JobAgent[] => {
  const runs = new Map(data.runs.map((run) => [run.id, run]));
  for (const run of data.activityRuns ?? []) runs.set(run.id, { ...runs.get(run.id), ...run });
  const active = [...runs.values()].filter(
    (run) =>
      run.cardId === cardId &&
      ['running', 'waiting'].includes(run.status) &&
      !run.reviewSeatReservation,
  );
  // Answered turns stay waiting until their continuation chain finishes. Follow question
  // links rather than grouping by role or root, which can also contain independent work.
  const superseded = new Set<string>();
  for (const run of active) {
    let current: Run | undefined = run;
    const visited = new Set<string>();
    while (current?.requestId && !visited.has(current.id)) {
      visited.add(current.id);
      const question = data.userInputs?.find(
        (question) =>
          question.status === 'answered' &&
          question.continuationRequestId === current?.requestId &&
          question.roleId === run.roleId,
      );
      if (!question) break;
      superseded.add(question.runId);
      current = runs.get(question.runId);
    }
  }
  const agents = active
    // Deep-review coordinators mirror their workers, including when a worker asks a question.
    // Their rootRunId can point farther upstream; the report identifies this execution.
    .filter(
      (run) =>
        !(
          run.purpose === 'deep-review' &&
          run.deepReviewId &&
          active.some(
            (other) =>
              other.id !== run.id &&
              other.deepReviewId === run.deepReviewId &&
              other.purpose !== 'deep-review',
          )
        ),
    )
    .filter((run) => run.status !== 'waiting' || !superseded.has(run.id))
    .map((run): JobAgent => ({
      run,
      name: data.roles.find((role) => role.id === run.roleId)?.name ?? run.roleId,
    }));
  return agents.map((agent) => {
    const peers = agents.filter((other) => other.name === agent.name);
    if (peers.length < 2) return agent;
    const ordered = peers.toSorted(
      (a, b) => a.run.startedAt.localeCompare(b.run.startedAt) || a.run.id.localeCompare(b.run.id),
    );
    const conversation = data.conversations?.find((thread) => thread.id === agent.run.threadId);
    return {
      ...agent,
      detail: `Turn ${ordered.indexOf(agent) + 1} · ${conversation?.title ?? agent.run.message}`,
    };
  });
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

export type ApplicationRow = {
  id: ApplicationSection;
  title: string;
  status: string;
  done: boolean;
  /** The user, not an agent, moves this step forward. */
  yours: boolean;
};

export const applicationRows = (
  card: Card,
  confirmed: boolean,
  exported: boolean,
): ApplicationRow[] => {
  const reviewed = Boolean(card.packetReview) && !packetNeedsReview(card);
  return [
    {
      id: 'brief',
      title: 'Brief and requirements',
      status: confirmed ? 'Confirmed' : 'Needs review',
      done: confirmed,
      yours: true,
    },
    {
      id: 'documents',
      title: 'Documents',
      status: card.packet ? 'Draft available' : 'Not drafted',
      done: Boolean(card.packet),
      yours: false,
    },
    {
      id: 'reviews',
      title: 'Reviews',
      status: reviewed ? 'Reviewed' : 'Review needed',
      done: reviewed,
      yours: false,
    },
    {
      id: 'export',
      title: 'Export',
      status: exported
        ? 'Exported'
        : card.state === 'awaiting_approval'
          ? 'Approval requested'
          : 'Not exported',
      done: exported,
      yours: true,
    },
  ];
};

/** Bead per application step: done, the first unfinished step as current, then to do. */
export const applicationBeads = (rows: ApplicationRow[]) => {
  const current = rows.findIndex((row) => !row.done);
  return rows.map((row, index) =>
    row.done ? 'done' : index === current ? (row.yours ? 'ochre' : 'current') : undefined,
  );
};
