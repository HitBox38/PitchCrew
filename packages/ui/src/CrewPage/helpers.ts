import type { BrowserMode, Role, Run, Snapshot } from '@pitchcrew/core';
import { savedBrowserMode } from '../lib/browser-modes.ts';
import { signInMissing } from '../lib/agent-start.ts';
import { runtimeLabels } from '../lib/labels.ts';
import { ageLabel, durationLabel } from '../lib/time.ts';
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

/** The browser line per saved mode: how much the agent does in its browser before it asks. */
const browserLines: Record<BrowserMode, string> = {
  supervised: 'Browser, asks first',
  autonomous: 'Browser, prepares forms',
  edits: 'Browser, fills forms',
  auto: 'Browser, asks before risky steps',
  full: 'Browser, full access',
};

/** One line naming what this agent is equipped to do, strongest permission first. */
export const capabilityLine = (role: Role): CapabilityLine => {
  const caps: Partial<NonNullable<Role['capabilities']>> = role.capabilities ?? {};
  const seat = role.workflow ?? (['scout', 'writer', 'reviewer'].includes(role.id) ? role.id : '');
  if (caps.computerUse) return { icon: 'browser', label: browserLines[savedBrowserMode(role)] };
  if (seat === 'writer') return { icon: 'draft', label: 'Drafts packets' };
  if (seat === 'reviewer') return { icon: 'review', label: 'Checks claims' };
  if (seat === 'scout') return { icon: 'fit', label: 'Scores job fit' };
  if (caps.trackApplications || caps.gmail) return { icon: 'mail', label: 'Reads Gmail' };
  if (caps.reviewPipeline) return { icon: 'crew', label: 'Reviews the crew' };
  if (caps.maintainProfile || caps.editProfile)
    return { icon: 'notes', label: 'Keeps your profile current' };
  if (caps.discoverJobs) return { icon: 'fit', label: 'Finds jobs' };
  return { icon: 'chat', label: 'Chat only' };
};

const subject = (data: Snapshot, cardId: string | null, threadId?: string) => {
  const card = cardId ? data.cards.find((item) => item.id === cardId) : undefined;
  if (card) return card.company;
  const conversation = data.conversations?.find((item) => item.id === threadId);
  return conversation?.title ?? 'Chat';
};

/** How long a run has worked, in Crew's compact style ("12m", "1h 5m"), as the lens stamps it. */
export const elapsed = (since: string, now: number) => durationLabel(since, now, 'compact');

/** How long ago, in Crew's compact style: "just now", "2h ago", "3d ago" (cards and lens alike). */
export const agoWords = (iso: string, now: number) => {
  const age = ageLabel(iso, now, 'compact');
  return age === 'just now' ? age : `${age} ago`;
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

/** The other live runs an agent has: how many, and the job when there is exactly one. */
const besides = (data: Snapshot, others: Run[]) => ({
  count: others.length,
  also: others.length === 1 ? subject(data, others[0]!.cardId, others[0]!.threadId) : undefined,
});

/** The chat stream's live copy of a run carries its latest public step; the snapshot's does not. */
const livePhase = (data: Snapshot, run: Run) =>
  runActivityLabel(data.activityRuns?.find((item) => item.id === run.id) ?? run);

/**
 * What the agent is doing now, in the order a person needs to know it: a pending question first,
 * then a browser request waiting on one of its live runs, then its newest live run (newest first,
 * as the snapshot lists runs), then setup or idle. Every status says whether any run of the role
 * is running, reservations included, so Pause is offered only when the server would accept it.
 */
export const crewStatus = (role: Role, data: Snapshot, now: number): CrewStatus => {
  const runs = data.runs.filter((item) => liveRun(item) && item.roleId === role.id);
  const busy = data.runs.some((item) => item.status === 'running' && item.roleId === role.id);
  const question = data.userInputs?.find(
    (item) => item.status === 'pending' && item.roleId === role.id,
  );
  if (question) {
    const { count, also } = besides(data, runs);
    return {
      kind: 'waiting',
      subject: subject(data, question.cardId, question.threadId),
      threadId: question.threadId,
      since: question.createdAt,
      alsoRunning: count,
      also,
      busy,
    };
  }
  // Pending only (as chat's participants read it): approved records still executing, and the
  // automatic ones the server allowed, never wait on the user.
  const approval = data.computerApprovals.find(
    (item) =>
      item.status === 'pending' &&
      !item.automatic &&
      item.roleId === role.id &&
      runs.some((run) => run.id === item.runId),
  );
  const asking = approval ? runs.find((run) => run.id === approval.runId) : undefined;
  if (approval && asking) {
    const { count, also } = besides(
      data,
      runs.filter((run) => run !== asking),
    );
    return {
      kind: 'approving',
      run: asking,
      approvalId: approval.id,
      subject: subject(data, approval.cardId ?? asking.cardId, asking.threadId),
      since: approval.createdAt,
      alsoRunning: count,
      also,
      busy,
    };
  }
  const [run, ...others] = runs;
  if (run) {
    const { count, also } = besides(data, others);
    return {
      kind: 'working',
      run,
      subject: subject(data, run.cardId, run.threadId),
      elapsed: elapsed(run.startedAt, now),
      phase: livePhase(data, run),
      more: count,
      also,
      busy,
    };
  }
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
      busy,
    };
  if (!runtime?.available) return { kind: 'unavailable', runtime: role.runtime, runtimeName, busy };
  if (signInMissing(data, role.runtime, role.model))
    return { kind: 'signin', runtime: role.runtime, runtimeName, busy };
  const last = data.runs
    .filter((item) => item.roleId === role.id && item.finishedAt && !item.reviewSeatReservation)
    .reduce<Run | undefined>(
      (latest, item) => (!latest || item.finishedAt! > latest.finishedAt! ? item : latest),
      undefined,
    );
  return {
    kind: 'idle',
    fact: last
      ? `Idle. Last worked on ${subject(data, last.cardId, last.threadId)} ${agoWords(last.finishedAt!, now)}.`
      : 'Idle. No runs yet.',
    busy,
  };
};

/** "Also working on Globex", "Also working on 2 more jobs", or '' when it runs nothing else. */
export const alsoWorking = (status: CrewStatus) => {
  const count =
    status.kind === 'working'
      ? status.more
      : status.kind === 'waiting' || status.kind === 'approving'
        ? status.alsoRunning
        : 0;
  if (!count) return '';
  if (count === 1)
    return 'also' in status && status.also
      ? `Also working on ${status.also}`
      : 'Also working on 1 more job';
  return `Also working on ${count} more jobs`;
};

/**
 * Whether one of the agent's runs is executing, so its pebble breathes: a run held on a browser
 * request is still, while other work beside a wait still breathes.
 */
export const crewExecuting = (status: CrewStatus) =>
  status.kind === 'working' ||
  ((status.kind === 'waiting' || status.kind === 'approving') && status.alsoRunning > 0);

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
