import {
  applicationQuery,
  externalApplicationInput,
  externalSubmissionInput,
  canonicalJobUrl,
  normalizeApplicationText,
  transitions,
  type Card,
  type TrackingSignal,
  type TrackingScan,
  type Approval,
} from '@pitchcrew/core';
import type { Board } from '../index.ts';
import { digestPacket } from './helpers.ts';

export function searchApplications(board: Board, data: unknown) {
  const query = applicationQuery.parse(data);
  const cards = board
    .list<Card>('card')
    .filter(
      (card) =>
        (!query.company ||
          normalizeApplicationText(card.company).includes(
            normalizeApplicationText(query.company),
          )) &&
        (!query.title ||
          normalizeApplicationText(card.title).includes(normalizeApplicationText(query.title))) &&
        (!query.url || canonicalJobUrl(card.url) === canonicalJobUrl(query.url)) &&
        (!query.jobIdentifier || card.tracking?.jobIdentifier === query.jobIdentifier) &&
        (!query.state || card.state === query.state),
    );
  const page = cards.slice(query.offset, query.offset + query.limit);
  const ids = new Set(page.map((card) => card.id));
  return {
    cards: page,
    // Each application includes a bounded recent evidence history.
    evidence: board
      .list<TrackingSignal>('tracking_signal')
      .filter(
        (signal) =>
          (signal.cardId && ids.has(signal.cardId)) ||
          signal.candidateIds.some((id) => ids.has(id)),
      )
      .slice(-100),
    nextOffset: query.offset + query.limit < cards.length ? query.offset + query.limit : null,
  };
}
export function registerExternalApplication(board: Board, data: unknown): Card {
  const { submittedAt, jobIdentifier, note, ...input } = externalApplicationInput.parse(data);
  if (Date.parse(submittedAt) > Date.now())
    throw new Error('Submission time cannot be in the future.');
  return board.db.transaction(() => {
    const duplicates = board
      .list<Card>('card')
      .filter(
        (card) =>
          normalizeApplicationText(card.company) === normalizeApplicationText(input.company) &&
          normalizeApplicationText(card.title) === normalizeApplicationText(input.title) &&
          (!card.url ||
            !input.url ||
            canonicalJobUrl(card.url) === canonicalJobUrl(input.url) ||
            (jobIdentifier && card.tracking?.jobIdentifier === jobIdentifier)),
      );
    if (duplicates.length)
      throw new Error(
        `Application already tracked: ${duplicates.map((card) => card.id).join(', ')}. Review the existing card.`,
      );
    const card = board.createCard(input);
    const external: Card = {
      ...card,
      state: 'submitted',
      statusEffectiveAt: submittedAt,
      tracking: { origin: 'external', submittedAt, jobIdentifier, note, gmailThreads: [] },
    };
    board.record(
      'card',
      external,
      'user',
      'Registered a known external submission; no outward action',
    );
    return external;
  })();
}
export function latestTrackingTime(board: Board, card: Card): number {
  let userBoundary = Date.parse(card.statusEffectiveAt ?? '') || 0;
  if (!userBoundary) {
    // Legacy cards have no explicit boundary. Find the latest user state change,
    // paging through retained history instead of using unrelated packet edits.
    let before: number | undefined;
    let newer: { state: Card['state']; actor: string; createdAt: string } | undefined;
    let found = false;
    while (!found) {
      const page = board.history(card.id, before, 200);
      for (const event of page) {
        if (event.kind !== 'card' || !('state' in event.data)) continue;
        if (newer && newer.actor === 'user' && newer.state !== event.data.state) {
          userBoundary = Date.parse(newer.createdAt);
          found = true;
          break;
        }
        newer = { state: event.data.state, actor: event.actor, createdAt: event.createdAt };
      }
      if (page.length < 200) break;
      before = page.at(-1)!.id;
    }
  }
  const times = board
    .list<TrackingSignal>('tracking_signal')
    .filter((signal) => signal.cardId === card.id && signal.status === 'applied')
    .map((signal) => Date.parse(signal.effectiveAt));
  return Math.max(0, Date.parse(card.tracking?.submittedAt ?? '') || 0, userBoundary, ...times);
}
export function registerExistingExternalSubmission(
  board: Board,
  cardId: string,
  data: unknown,
): Card {
  const input = externalSubmissionInput.parse(data);
  if (Date.parse(input.submittedAt) > Date.now())
    throw new Error('Submission time cannot be in the future.');
  return board.db.transaction(() => {
    const card = board.get<Card>('card', cardId);
    if (card.owner || board.hasActiveRun(cardId))
      throw new Error('Wait for active workflow work before registering an external submission.');
    if (
      ![
        'lead',
        'shortlisted',
        'drafting',
        'in_review',
        'changes_requested',
        'agreed',
        'awaiting_approval',
      ].includes(card.state)
    )
      throw new Error('This application already has a tracked submission or outcome.');
    const next: Card = {
      ...card,
      state: 'submitted',
      statusEffectiveAt: input.submittedAt,
      updatedAt: new Date().toISOString(),
      tracking: {
        ...card.tracking,
        ...input,
        origin: 'external',
        gmailThreads: card.tracking?.gmailThreads ?? [],
      },
    };
    for (const approval of board
      .list<Approval>('approval')
      .filter((value) => value.cardId === cardId && ['pending', 'approved'].includes(value.status)))
      board.record(
        'approval',
        { ...approval, status: 'rejected', decidedAt: new Date().toISOString() },
        'user',
        'Invalidated unused packet approval after registering an external submission',
      );
    board.record(
      'card',
      next,
      'user',
      'Registered known external submission on existing application; retained packet is not identified as submitted',
    );
    return next;
  })();
}
export function trackingConflict(board: Board, signal: TrackingSignal, card: Card): string {
  if (
    signal.state === 'submitted' &&
    card.state !== 'submitted' &&
    (!card.packet ||
      !board
        .list<Approval>('approval')
        .some(
          (approval) =>
            approval.cardId === card.id &&
            approval.status === 'consumed' &&
            approval.exportDirectory &&
            card.packet &&
            approval.digest === digestPacket(card.id, card.packet),
        ))
  )
    return 'Approve and export the current reviewed packet before tracking its submission.';
  if (Date.parse(signal.effectiveAt) < latestTrackingTime(board, card))
    return 'Older than the latest evidence or user status correction.';
  if (
    Date.parse(signal.effectiveAt) === latestTrackingTime(board, card) &&
    card.state !== signal.state
  )
    return 'Conflicting evidence at the same time.';
  if (card.owner || board.hasActiveRun(card.id)) return 'Application has active workflow work.';
  if (card.state !== signal.state && !transitions[card.state].includes(signal.state))
    return `Cannot move ${card.state} to ${signal.state}.`;
  return '';
}
export function applyTrackingSignal(
  board: Board,
  signal: TrackingSignal,
  card: Card,
  actor: string,
): TrackingSignal {
  const conflict = trackingConflict(board, signal, card);
  if (conflict) throw new Error(conflict);
  if (card.state !== signal.state)
    board.move(card.id, signal.state, actor, 'Updated application from verified Gmail evidence');
  if (actor === 'user' && card.state !== signal.state) {
    // Reviewing historical evidence preserves its source time; manual outcome
    // corrections still use the actual user action time.
    const updated = board.get<Card>('card', card.id);
    board.record(
      'card',
      { ...updated, statusEffectiveAt: signal.effectiveAt },
      actor,
      'Accepted verified evidence effective time',
    );
  }
  const applied: TrackingSignal = {
    ...signal,
    cardId: card.id,
    status: 'applied',
    decidedAt: new Date().toISOString(),
  };
  board.record('tracking_signal', applied, actor, 'Applied tracking evidence');
  return applied;
}
export function decideTrackingSignal(
  board: Board,
  id: string,
  approved: boolean,
  cardId?: string,
  cardUpdatedAt?: string,
): TrackingSignal {
  return board.db.transaction(() => {
    const signal = board.get<TrackingSignal>('tracking_signal', id);
    if (signal.status !== 'pending') throw new Error('Tracking proposal has already been decided.');
    if (!approved) {
      const rejected: TrackingSignal = {
        ...signal,
        status: 'rejected',
        decidedAt: new Date().toISOString(),
      };
      board.record('tracking_signal', rejected, 'user', 'Rejected tracking proposal');
      return rejected;
    }
    if (!cardId || (signal.candidateIds.length && !signal.candidateIds.includes(cardId)))
      throw new Error('Choose one of the proposed applications.');
    const card = board.get<Card>('card', cardId);
    const expected = signal.expectedCards.find((value) => value.id === cardId);
    if (
      expected
        ? expected.state !== card.state || expected.updatedAt !== card.updatedAt
        : cardUpdatedAt !== card.updatedAt
    )
      throw new Error('Application changed since this proposal. Reconcile again.');
    const applied = applyTrackingSignal(board, signal, card, 'user');
    linkTrackingThread(board, cardId, signal.account, signal.threadId);
    return applied;
  })();
}
export function linkTrackingThread(
  board: Board,
  cardId: string,
  account: string,
  threadId: string,
): Card {
  return board.db.transaction(() => {
    const card = board.get<Card>('card', cardId);
    const tracking = card.tracking ?? { origin: 'pitchcrew' as const, gmailThreads: [] };
    if (
      tracking.gmailThreads.some((link) => link.account === account && link.threadId === threadId)
    )
      return card;
    if (tracking.gmailThreads.length >= 50)
      throw new Error(
        'An application can link at most 50 Gmail threads. Unlink old threads first.',
      );
    const updated = {
      ...card,
      tracking: { ...tracking, gmailThreads: [...tracking.gmailThreads, { account, threadId }] },
      updatedAt: new Date().toISOString(),
    };
    board.record(
      'card',
      updated,
      'user',
      'Linked Gmail thread for future application reconciliation',
    );
    return updated;
  })();
}
export function updateTrackingIdentifier(
  board: Board,
  cardId: string,
  jobIdentifier: string,
): Card {
  const card = board.get<Card>('card', cardId);
  const tracking = card.tracking ?? { origin: 'pitchcrew' as const, gmailThreads: [] };
  const updated = {
    ...card,
    tracking: { ...tracking, jobIdentifier },
    updatedAt: new Date().toISOString(),
  };
  board.record('card', updated, 'user', 'Updated application job identifier');
  return updated;
}
export function unlinkTrackingThread(
  board: Board,
  cardId: string,
  account: string,
  threadId: string,
): Card {
  const card = board.get<Card>('card', cardId);
  if (!card.tracking) return card;
  const next = {
    ...card,
    tracking: {
      ...card.tracking,
      gmailThreads: card.tracking.gmailThreads.filter(
        (link) => link.account !== account || link.threadId !== threadId,
      ),
    },
    updatedAt: new Date().toISOString(),
  };
  board.record('card', next, 'user', 'Removed Gmail thread link');
  return next;
}
export function refreshTrackingSignal(board: Board, id: string): TrackingSignal {
  const signal = board.get<TrackingSignal>('tracking_signal', id);
  if (signal.status !== 'pending')
    throw new Error('Only pending tracking comparisons can be refreshed.');
  const refreshed = {
    ...signal,
    expectedCards: signal.candidateIds.map((cardId) => {
      const card = board.get<Card>('card', cardId);
      return { id: cardId, state: card.state, updatedAt: card.updatedAt };
    }),
  };
  board.record(
    'tracking_signal',
    refreshed,
    'user',
    'Refreshed comparison against current applications',
  );
  return refreshed;
}
export function completeTrackingMessage(board: Board, scan: TrackingScan, messageId: string) {
  board.record(
    'tracking_scan',
    {
      ...scan,
      pendingIds: scan.pendingIds.filter((id) => id !== messageId),
      updatedAt: new Date().toISOString(),
    },
    scan.roleId,
    'Completed tracking message',
  );
}
