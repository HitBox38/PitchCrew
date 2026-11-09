import type { Card, Role, Snapshot } from '@pitchcrew/core';
import { closedStateSet } from '../board-stages.ts';
import { stateLabels } from '../lib/labels.ts';
import { runActivityLabel } from '../lib/work-queue.ts';
import { workflowSeat } from '@pitchcrew/core/states';
import { jobStep, snapshotStepFacts, type JobStep } from '../lib/job-step.ts';
import { jobBeadTone, trackIndex } from './helpers.ts';
import { packetTitle } from './packet-guidance.ts';
import { decisions, jobSignals, signalAsks, type Decision, type JobSignal } from './signals.ts';

export type SidebarJob = { card: Card; signal: JobSignal; status: string };

const roleName = (roles: Role[], id: string | null | undefined) =>
  roles.find((role) => role.id === id)?.name ?? 'An agent';

export const jobStatus = (card: Card, signal: JobSignal, roles: Role[]) => {
  const { decision, run } = signal;
  if (decision?.kind === 'packet') return decision.status ?? 'Approve packet';
  if (decision?.kind === 'browser') return 'Browser request';
  if (decision?.kind === 'brief') return 'Confirm brief';
  if (decision?.kind === 'question') return `${roleName(roles, decision.roleId)} asked`;
  if (run) return `${roleName(roles, run.roleId)} working`;
  return stateLabels[card.state];
};

/** Jobs past the lead stage, ordered: needs you, working, then most recently changed. */
export const sidebarJobs = (data: Snapshot) => {
  const signals = jobSignals(data);
  const rank = (signal: JobSignal) => (signalAsks(signal) ? 0 : signal.run ? 1 : 2);
  const jobs = data.cards
    .filter((card) => !closedStateSet.has(card.state) && card.state !== 'lead')
    .map((card) => {
      const signal = signals.get(card.id) ?? {};
      return { card, signal, status: jobStatus(card, signal, data.roles) };
    })
    .sort(
      (a, b) => rank(a.signal) - rank(b.signal) || b.card.updatedAt.localeCompare(a.card.updatedAt),
    );
  const leads = data.cards.filter((card) => card.state === 'lead');
  return { jobs, leads };
};

export const decisionTitle = (decision: Decision, data: Snapshot) => {
  const card = data.cards.find((item) => item.id === decision.cardId);
  const who = roleName(data.roles, decision.roleId);
  if (decision.kind === 'packet') {
    const approval = data.approvals.find((item) => item.id === decision.id);
    if (approval) return packetTitle(approval, card);
    return `Approve the ${card?.company ?? ''} packet?`.replace('  ', ' ');
  }
  if (decision.kind === 'browser') return `${who} asks to use the browser`;
  if (decision.kind === 'brief') return `Confirm the ${card?.company ?? 'job'} brief`;
  return `${who} has a question`;
};

export const decisionSummary = (data: Snapshot) => {
  const count = decisions(data).length;
  if (!count) return 'Nothing is waiting on you.';
  return `${count} ${count === 1 ? 'decision is' : 'decisions are'} waiting on you, oldest first.`;
};

const seatName = (data: Snapshot, seat: 'scout' | 'writer' | 'reviewer', fallback: string) =>
  data.roles.find((role) => role.enabled && !role.retiredAt && workflowSeat(role) === seat)?.name ??
  fallback;

export type NextUp = { text: string; tone: 'asks' | 'working' | 'next' };

/**
 * Who has the job's next move: the user when a decision waits, the agent working on it, or the
 * next application step from the same brief, form, fit and packet gates as job details' action.
 * Shown beside clay stage tracks.
 */
export const nextUp = (card: Card, data: Snapshot): NextUp | null => {
  const signal = jobSignals(data).get(card.id) ?? {};
  const { decision, run } = signal;
  if (decision && signalAsks(signal))
    return { text: `Waiting on you: ${decisionTitle(decision, data)}`, tone: 'asks' };
  if (run) return { text: `${roleName(data.roles, run.roleId)} is working`, tone: 'working' };
  if (decision) return { text: decision.status ?? decisionTitle(decision, data), tone: 'next' };
  if (trackIndex(card.state) === null) return null;
  const step = jobStep(card, snapshotStepFacts(card, data.approvals));
  const scout = seatName(data, 'scout', 'Scout');
  const writer = seatName(data, 'writer', 'Writer');
  const next: Record<JobStep, string> = {
    'prepare-brief': 'you prepare the job brief',
    'confirm-brief': 'you confirm the job brief',
    'check-form': 'you check the application form',
    'answer-requirements': 'you answer the brief’s required questions',
    'evaluate-fit': `${scout} checks the fit`,
    shortlist: 'you decide whether to shortlist',
    draft: `${writer} drafts the packet`,
    revise: `${writer} revises the packet`,
    drafting: `${writer} finishes the draft`,
    review: `${seatName(data, 'reviewer', 'Reviewer')} reviews the packet`,
    export: 'you prepare the export for approval',
    approve: 'you approve the packet',
    apply: 'you apply, then record your submission',
    outcome: outcomeNext[card.state] ?? 'you record their reply',
  };
  return step ? { text: `Next: ${next[step]}`, tone: 'next' } : null;
};

const outcomeNext: Partial<Record<Card['state'], string>> = {
  submitted: 'you record their reply',
  screening: 'you prepare for screening and record the result',
  interviewing: 'you prepare for interviews and record the outcome',
  offer: 'you review the offer and record your decision',
};

export type CardLine = { text: string; tone?: 'asks' | 'working' };

/**
 * The line under a job card's identity: the user's decision, the working agent and its public
 * activity, or, while nothing runs, the named wait for the stage (who has to start next). Leads and
 * shortlisted jobs show their location, applied jobs their recorded status. A running agent is
 * never inferred from the stage alone.
 */
export const cardLine = (card: Card, signal: JobSignal, data: Snapshot): CardLine => {
  if (signal.decision)
    return {
      text: jobStatus(card, signal, data.roles),
      tone: signalAsks(signal) ? 'asks' : signal.run ? 'working' : undefined,
    };
  if (signal.run)
    return {
      text: `${roleName(data.roles, signal.run.roleId)} · ${runActivityLabel(signal.run)}`,
      tone: 'working',
    };
  const index = trackIndex(card.state);
  if (index === null || index === 5) return { text: stateLabels[card.state] };
  if (index < 2) return { text: card.location || '' };
  const writer = seatName(data, 'writer', 'Writer');
  const wait: Partial<Record<Card['state'], string>> = {
    drafting: `Ready for ${writer}`,
    changes_requested: `Changes requested · ${writer} next`,
    in_review: `Ready for ${seatName(data, 'reviewer', 'Reviewer')}`,
    agreed: 'Ready for your approval',
  };
  return { text: wait[card.state] ?? stateLabels[card.state] };
};

/**
 * Up to five summary beads for a board column heading, in the column's order: ochre when the user
 * is asked, plum and live only while an agent works, otherwise the job's place at rest.
 */
export const columnBeads = (cards: Card[], signals: Map<string, JobSignal>) =>
  cards.slice(0, 5).map((card) => {
    const signal = signals.get(card.id);
    const asks = !!signal && signalAsks(signal);
    const working = !!signal?.run && !asks;
    const tone = jobBeadTone(card.state, {
      asks,
      working,
      preparing: signal?.decision?.stage === 'preparing',
    });
    return { id: card.id, tone, live: working };
  });

/** Who is behind a decision and when it arrived: the reviewer for a packet, else the asking agent. */
export const decisionSource = (decision: Decision, data: Snapshot) => {
  const card = data.cards.find((item) => item.id === decision.cardId);
  if (decision.kind === 'packet') {
    const approval = data.approvals.find((item) => item.id === decision.id);
    const handoff = approval?.submission;
    if (decision.stage === 'apply') return { roleId: null, text: 'You exported the files' };
    if (decision.stage === 'choose') return { roleId: null, text: 'You approved' };
    if (decision.stage === 'verify')
      return { roleId: handoff?.roleId ?? null, text: 'Submission uncertain' };
    if (decision.stage === 'preparing')
      return {
        roleId: handoff?.roleId ?? null,
        text: `Handed to ${roleName(data.roles, handoff?.roleId)}`,
      };
    const run = data.runs.find((item) => item.id === card?.packetReview?.runId);
    return { roleId: run?.roleId ?? null, text: `${roleName(data.roles, run?.roleId)} agreed` };
  }
  if (decision.kind === 'brief') return { roleId: null, text: 'Brief extracted' };
  const verb = decision.kind === 'browser' ? 'asks' : 'asked';
  return { roleId: decision.roleId, text: `${roleName(data.roles, decision.roleId)} ${verb}` };
};
