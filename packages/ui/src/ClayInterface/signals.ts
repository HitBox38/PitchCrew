import { computerApprovalLifecycle } from '@pitchcrew/core/lifecycles';
import type { Card, Run, Snapshot } from '@pitchcrew/core';
import { closedStateSet } from '../board-stages.ts';
import { packetNeedsAction } from '../lib/inbox.ts';
import { executingRuns } from '../lib/work-queue.ts';
import {
  packetDetails,
  packetStage,
  packetStatus,
  packetWaitsOnUser,
  type PacketStage,
} from './packet-guidance.ts';

export type Decision = {
  id: string;
  kind: 'packet' | 'browser' | 'question' | 'brief';
  cardId: string | null;
  roleId: string | null;
  /** Conversation that holds a question; packets and browser requests decide on the Decisions page, briefs in job details. */
  threadId: string | null;
  detail: string;
  createdAt: string;
  /** Packets only: where the approved or pending packet stands, and its short card/sidebar status. */
  stage?: PacketStage;
  status?: string;
};

/**
 * An extracted brief stays unconfirmed until the user confirms its current revision. Leads defer
 * it: fit and shortlisting lead there, and confirmation gates drafting once the job is shortlisted.
 */
const needsBrief = (card: Card) => {
  const context = card.applicationContext;
  return (
    !!context &&
    card.state !== 'lead' &&
    !closedStateSet.has(card.state) &&
    (!context.confirmedAt || context.confirmedRevision !== context.revision)
  );
};

/** Everything waiting on the user, oldest first so nothing starves at the back. */
export const decisions = (data: Snapshot): Decision[] =>
  [
    ...data.approvals
      .filter((approval) => packetNeedsAction(approval, data.cards))
      .map((approval) => {
        const card = data.cards.find((item) => item.id === approval.cardId);
        const stage = packetStage(approval, card);
        return {
          id: approval.id,
          kind: 'packet' as const,
          cardId: approval.cardId,
          roleId: null,
          threadId: null,
          detail: packetDetails[stage],
          createdAt: approval.createdAt,
          stage,
          status: packetStatus(approval, card, data),
        };
      }),
    ...data.computerApprovals
      .filter((approval) => computerApprovalLifecycle.is('open', approval.status))
      .map((approval) => ({
        id: approval.id,
        kind: 'browser' as const,
        cardId: approval.cardId,
        roleId: approval.roleId,
        threadId: null,
        detail: approval.reason || 'Approve a browser action',
        createdAt: approval.createdAt,
      })),
    ...(data.userInputs ?? [])
      .filter((input) => input.status === 'pending')
      .map((input) => ({
        id: input.id,
        kind: 'question' as const,
        cardId: input.cardId,
        roleId: input.roleId,
        threadId: input.threadId,
        detail: input.question,
        createdAt: input.createdAt,
      })),
    ...data.cards.filter(needsBrief).map((card) => ({
      id: `brief-${card.id}`,
      kind: 'brief' as const,
      cardId: card.id,
      roleId: null,
      threadId: null,
      detail: 'Confirm the brief',
      createdAt: card.applicationContext?.createdAt ?? card.updatedAt,
    })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

/** A decision is the user's move, except an agent's packet preparation that is still going. */
export const decisionWaits = (decision: Decision, data: Snapshot) => {
  if (decision.kind !== 'packet') return true;
  const approval = data.approvals.find((item) => item.id === decision.id);
  const card = data.cards.find((item) => item.id === decision.cardId);
  return !approval || packetWaitsOnUser(approval, card, data);
};

/** Whether anything on this job waits on the user, for its stage track's current bead. */
export const jobAsks = (cardId: string, data: Snapshot) =>
  decisions(data).some((decision) => decision.cardId === cardId && decisionWaits(decision, data));

export type JobSignal = { run?: Run; decision?: Decision; asks?: boolean };

/** Presentation attention, distinct from a packet that is still listed while an agent prepares. */
export const signalAsks = (signal: JobSignal) => signal.asks ?? !!signal.decision;

export const jobSignals = (data: Snapshot) => {
  const signals = new Map<string, JobSignal>();
  for (const run of executingRuns(data.runs)) {
    if (run.cardId) signals.set(run.cardId, { ...signals.get(run.cardId), run });
  }
  for (const decision of decisions(data)) {
    if (!decision.cardId) continue;
    const prior = signals.get(decision.cardId);
    const asks = decisionWaits(decision, data);
    // A real browser approval or question takes precedence over informational preparation.
    if (prior?.decision && (signalAsks(prior) || !asks)) continue;
    signals.set(decision.cardId, { ...prior, decision, asks });
  }
  return signals;
};
