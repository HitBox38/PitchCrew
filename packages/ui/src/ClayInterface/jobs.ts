import type { Card, Role, Snapshot } from '@pitchcrew/core';
import { closedStateSet } from '../board-stages.ts';
import { stateLabels } from '../lib/labels.ts';
import { jobSignals, type Decision, type JobSignal } from './signals.ts';

export type SidebarJob = { card: Card; signal: JobSignal; status: string };

const roleName = (roles: Role[], id: string | null | undefined) =>
  roles.find((role) => role.id === id)?.name ?? 'An agent';

export const jobStatus = (card: Card, signal: JobSignal, roles: Role[]) => {
  const { decision, run } = signal;
  if (decision?.kind === 'packet') return 'Approve packet';
  if (decision?.kind === 'browser') return 'Browser request';
  if (decision?.kind === 'brief') return 'Confirm brief';
  if (decision?.kind === 'question') return `${roleName(roles, decision.roleId)} asked`;
  if (run) return `${roleName(roles, run.roleId)} working`;
  return stateLabels[card.state];
};

/** Jobs past the lead stage, ordered: needs you, working, then most recently changed. */
export const sidebarJobs = (data: Snapshot) => {
  const signals = jobSignals(data);
  const rank = (signal: JobSignal) => (signal.decision ? 0 : signal.run ? 1 : 2);
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
  if (decision.kind === 'packet')
    return `Approve the ${card?.company ?? ''} packet?`.replace('  ', ' ');
  if (decision.kind === 'browser') return `${who} asks to use the browser`;
  if (decision.kind === 'brief') return `Confirm the ${card?.company ?? 'job'} brief`;
  return `${who} has a question`;
};
