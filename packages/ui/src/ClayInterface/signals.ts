import type { Card, Run, Snapshot } from '@pitchcrew/core';
import { closedStateSet } from '../board-stages.ts';
import { packetNeedsAction } from '../lib/inbox.ts';
import { executingRuns } from '../lib/work-queue.ts';

export type Decision = {
  id: string;
  kind: 'packet' | 'browser' | 'question' | 'brief';
  cardId: string | null;
  roleId: string | null;
  /** Conversation that holds a question; packets and browser requests decide on the Decisions page, briefs in job details. */
  threadId: string | null;
  detail: string;
  createdAt: string;
};

/** An extracted brief stays unconfirmed until the user confirms its current revision. */
const needsBrief = (card: Card) => {
  const context = card.applicationContext;
  return (
    !!context &&
    !closedStateSet.has(card.state) &&
    (!context.confirmedAt || context.confirmedRevision !== context.revision)
  );
};

/** Everything waiting on the user, oldest first so nothing starves at the back. */
export const decisions = (data: Snapshot): Decision[] =>
  [
    ...data.approvals
      .filter((approval) => packetNeedsAction(approval, data.cards))
      .map((approval) => ({
        id: approval.id,
        kind: 'packet' as const,
        cardId: approval.cardId,
        roleId: null,
        threadId: null,
        detail: 'Approve the packet',
        createdAt: approval.createdAt,
      })),
    ...data.computerApprovals
      .filter((approval) => ['pending', 'approved'].includes(approval.status))
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

export type JobSignal = { run?: Run; decision?: Decision };

export const jobSignals = (data: Snapshot) => {
  const signals = new Map<string, JobSignal>();
  for (const run of executingRuns(data.runs)) {
    if (run.cardId) signals.set(run.cardId, { ...signals.get(run.cardId), run });
  }
  for (const decision of decisions(data)) {
    if (!decision.cardId || signals.get(decision.cardId)?.decision) continue;
    signals.set(decision.cardId, { ...signals.get(decision.cardId), decision });
  }
  return signals;
};
