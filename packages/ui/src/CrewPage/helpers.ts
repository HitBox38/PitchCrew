import type { Role, Run, Snapshot } from '@pitchcrew/core';
import { runtimeLabels } from '../lib/labels.ts';
import { timeAgo } from '../lib/time.ts';
import { runActivityLabel } from '../lib/work-queue.ts';
import type { CapabilityLine, CrewStatus } from './types.ts';

/** Seeded roles in the crew's reading order; custom roles follow in saved order. */
const seatOrder = [
  'scout',
  'writer',
  'reviewer',
  'submitter',
  'career-coach',
  'tracker',
  'pipeline-coach',
  'documenter',
];

export const crewRoster = (roles: Role[]): Role[] => {
  const rank = (role: Role) => {
    const index = seatOrder.indexOf(role.id);
    return index === -1 ? seatOrder.length : index;
  };
  return roles.filter((role) => !role.retiredAt).toSorted((a, b) => rank(a) - rank(b));
};

const liveRun = (run: Run) => run.status === 'running' && !run.reviewSeatReservation;

/** "8 agents, 2 working" for the Crew title row. */
export const crewSummary = (data: Snapshot): string => {
  const roster = crewRoster(data.roles);
  const working = roster.filter((role) =>
    data.runs.some((run) => liveRun(run) && run.roleId === role.id),
  ).length;
  return `${roster.length} ${roster.length === 1 ? 'agent' : 'agents'}, ${working} working`;
};

/** One line naming what this agent is equipped to do, strongest permission first. */
export const capabilityLine = (role: Role): CapabilityLine => {
  const caps: Partial<NonNullable<Role['capabilities']>> = role.capabilities ?? {};
  const seat = role.workflow ?? (['scout', 'writer', 'reviewer'].includes(role.id) ? role.id : '');
  if (caps.computerUse)
    return {
      icon: 'browser',
      label: role.browserMode === 'autonomous' ? 'Browser, prepares forms' : 'Browser, asks first',
    };
  if (seat === 'writer') return { icon: 'draft', label: 'Drafts packets' };
  if (seat === 'reviewer') return { icon: 'review', label: 'Checks claims' };
  if (seat === 'scout') return { icon: 'fit', label: 'Scores job fit' };
  if (caps.trackApplications || caps.gmail) return { icon: 'mail', label: 'Reads Gmail' };
  if (caps.reviewPipeline) return { icon: 'crew', label: 'Reviews the crew' };
  if (caps.maintainProfile) return { icon: 'notes', label: 'Keeps your profile current' };
  if (caps.discoverJobs) return { icon: 'fit', label: 'Finds jobs' };
  return { icon: 'chat', label: 'Chat only' };
};

const subject = (data: Snapshot, cardId: string | null, threadId?: string) => {
  const card = cardId ? data.cards.find((item) => item.id === cardId) : undefined;
  if (card) return card.company;
  const conversation = data.conversations?.find((item) => item.id === threadId);
  return conversation?.title ?? 'Chat';
};

export const elapsed = (since: string, now: number) => {
  const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000));
  if (minutes < 1) return 'just started';
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const services = {
  github: 'GitHub',
  gmail: 'Gmail',
  drive: 'Drive',
  calendar: 'Calendar',
  sheets: 'Sheets',
};

/** A connected-service tool the agent has switched on but no account currently provides. */
const missingAccount = (role: Role, data: Snapshot) =>
  (Object.keys(services) as (keyof typeof services)[]).find(
    (service) =>
      role.capabilities?.[service] &&
      !data.connectors.some((account) => account.connected && account.services.includes(service)),
  );

const signInMissing = (role: Role, data: Snapshot) =>
  data.runtimeMaintenance?.authentication.some(
    (entry) =>
      entry.runtime === role.runtime &&
      (entry.model === role.model || entry.model === '') &&
      entry.result.status === 'missing',
  ) ?? false;

/** What the agent is doing now, in the order a person needs to know it. */
export const crewStatus = (role: Role, data: Snapshot, now: number): CrewStatus => {
  const run = data.runs.find((item) => liveRun(item) && item.roleId === role.id);
  if (run)
    return {
      kind: 'working',
      run,
      subject: subject(data, run.cardId, run.threadId),
      elapsed: elapsed(run.startedAt, now),
      phase: runActivityLabel(run),
    };
  const question = data.userInputs?.find(
    (item) => item.status === 'pending' && item.roleId === role.id,
  );
  if (question)
    return {
      kind: 'waiting',
      subject: subject(data, question.cardId, question.threadId),
      threadId: question.threadId,
    };
  const runtime = data.runtimes.find((item) => item.id === role.runtime);
  const runtimeName = runtimeLabels[role.runtime] ?? role.runtime;
  const account = missingAccount(role, data);
  if (!role.enabled)
    return {
      kind: 'paused',
      cause: !runtime?.available
        ? { text: `Install ${runtimeName} to run it.`, section: 'runtimes', runtime: role.runtime }
        : account
          ? {
              text: `Connect ${account === 'github' ? 'GitHub' : 'Google'} for ${services[account]}.`,
              section: 'accounts',
            }
          : undefined,
    };
  if (!runtime?.available) return { kind: 'unavailable', runtime: role.runtime, runtimeName };
  if (signInMissing(role, data)) return { kind: 'signin', runtime: role.runtime, runtimeName };
  const last = data.runs
    .filter((item) => item.roleId === role.id && item.finishedAt && !item.reviewSeatReservation)
    .reduce<Run | undefined>(
      (latest, item) => (!latest || item.finishedAt! > latest.finishedAt! ? item : latest),
      undefined,
    );
  return {
    kind: 'idle',
    fact: last
      ? `Idle. Last worked on ${subject(data, last.cardId, last.threadId)} ${timeAgo(last.finishedAt!).toLowerCase()}.`
      : 'Idle. No runs yet.',
  };
};

/** Today's runs, oldest first, for the keyboard-reachable list under the timeline. */
export const todaysRuns = (roleId: string, data: Snapshot, now: number) => {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return data.runs
    .filter(
      (run) =>
        run.roleId === roleId &&
        !run.reviewSeatReservation &&
        Date.parse(run.startedAt) >= day.getTime(),
    )
    .toSorted((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((run) => ({ run, subject: subject(data, run.cardId, run.threadId) }));
};

/** Pending role and skill proposals the user has not decided yet. */
export const pendingProposals = (data: Snapshot) => [
  ...data.proposals
    .filter((proposal) => proposal.status === 'pending')
    .map((proposal) => ({
      id: proposal.id,
      kind: 'role' as const,
      roleId: proposal.sourceRoleId ?? proposal.roleId,
      targetId: proposal.roleId,
      reason: proposal.reason,
      thread: proposal.roleId,
    })),
  ...data.skillProposals
    .filter((proposal) => proposal.status === 'pending')
    .map((proposal) => ({
      id: proposal.id,
      kind: 'skill' as const,
      roleId: proposal.roleId,
      targetId: proposal.skill.name,
      reason: proposal.reason,
      thread: proposal.threadId ?? proposal.roleId,
    })),
];

/** "Codex · GPT-6.1 Sol", using the installed catalog's label when it has one. */
export const runtimeLine = (role: Role, data: Snapshot) => {
  const runtime = runtimeLabels[role.runtime] ?? role.runtime;
  if (role.runtime === 'demo') return `${runtime} · Scripted`;
  const model = data.runtimes
    .find((item) => item.id === role.runtime)
    ?.models.find((item) => item.value === role.model)?.label;
  return `${runtime} · ${model ?? (role.model || 'CLI default')}`;
};

/**
 * Pause or resume using the role's saved settings only, so a draft in an open agent panel is never
 * saved along with it.
 */
export const roleToggleBody = (role: Role) => ({
  runtime: role.runtime,
  model: role.model,
  enabled: !role.enabled,
  instructions: role.instructions,
  capabilities: role.capabilities,
});
