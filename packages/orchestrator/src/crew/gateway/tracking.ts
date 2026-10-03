import {
  searchApplications,
  completeTrackingMessage,
  applyTrackingSignal,
  trackingConflict,
} from '@pitchcrew/board';
import {
  defaultCapabilities,
  trackingReconciliation,
  normalizeApplicationText,
  type Card,
  type Role,
  type TrackingScan,
  type TrackingSignal,
} from '@pitchcrew/core';
import { z } from 'zod';
import type { CrewContext, RunCapability } from '../types.ts';
import {
  identityInSource,
  messageBody,
  sourceMatches,
  sourceState,
  trackingId,
  verifiedGmail,
} from '../tracking/helpers.ts';

function authorize(context: CrewContext, capability: RunCapability, token: string, write: boolean) {
  const role = context.board.get<Role>('role', capability.roleId);
  if (!role.enabled) throw new Error('Tracking is disabled for this role.');
  const permissions = {
    ...defaultCapabilities,
    ...role.capabilities,
  };
  const signal = context.controllers.get(capability.runId)?.signal;
  if (context.capabilities.get(token) !== capability || !signal || signal.aborted)
    throw new Error('Tracking requires an active run.');
  if (
    !permissions.readApplications ||
    (write && (!permissions.trackApplications || !permissions.gmail))
  )
    throw new Error(
      'Enable read applications, and Gmail plus track applications for reconciliation.',
    );
  return signal;
}
function account(context: CrewContext): string {
  const google = context.connectors
    .status()
    .find((value) => value.id === 'google' && value.connected && value.services.includes('gmail'));
  if (!google?.account) throw new Error('Connect Gmail before scanning applications.');
  return google.account;
}
export async function trackingAction(
  this: CrewContext,
  capability: RunCapability,
  token: string,
  action: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const signal = authorize(this, capability, token, action !== 'applications');
  if (action === 'applications') return searchApplications(this.board, data.input ?? {});
  const mailbox = account(this);
  if (action === 'tracking_scan') {
    const { query } = z
      .object({ query: z.string().trim().min(1).max(1000) })
      .strict()
      .parse(data.input);
    const id = trackingId(capability.roleId, mailbox, query);
    const current = this.board.list<TrackingScan>('tracking_scan').find((scan) => scan.id === id);
    if (current?.pendingIds.length) return { scan: current };
    const pageToken = current?.complete ? null : (current?.nextPageToken ?? null);
    const page = z
      .object({
        messages: z
          .array(z.object({ id: z.string().min(1) }))
          .max(20)
          .default([]),
        nextPageToken: z.string().max(2000).optional(),
      })
      .parse(
        await this.connectors.call(
          'gmail_search_messages',
          { query, limit: 20, ...(pageToken ? { pageToken } : {}) },
          signal,
        ),
      );
    authorize(this, capability, token, true);
    if (account(this) !== mailbox) throw new Error('Gmail account changed during the scan.');
    return this.board.db.transaction(() => {
      const latest = this.board.list<TrackingScan>('tracking_scan').find((scan) => scan.id === id);
      if (latest && latest.updatedAt !== current?.updatedAt) return { scan: latest };
      const processed = new Set(
        this.board
          .list<TrackingSignal>('tracking_signal')
          .filter((value) => value.account === mailbox)
          .map((value) => value.messageId),
      );
      const scan: TrackingScan = {
        id,
        roleId: capability.roleId,
        account: mailbox,
        query,
        pageToken,
        nextPageToken: page.nextPageToken ?? null,
        pendingIds: [...new Set(page.messages.map((value) => value.id))].filter(
          (messageId) => !processed.has(messageId),
        ),
        complete: !page.nextPageToken,
        updatedAt: new Date().toISOString(),
      };
      this.board.record('tracking_scan', scan, capability.roleId, 'Saved Gmail tracking scan page');
      return { scan };
    })();
  }
  const input = trackingReconciliation.parse(data.input);
  const scan = this.board.get<TrackingScan>('tracking_scan', input.scanId);
  if (scan.roleId !== capability.roleId || scan.account !== mailbox)
    throw new Error('This scan belongs to another role or mailbox.');
  const id = trackingId(mailbox, input.messageId);
  const existing = this.board
    .list<TrackingSignal>('tracking_signal')
    .find((value) => value.id === id);
  if (existing)
    return this.board.db.transaction(() => {
      const latest = this.board.get<TrackingScan>('tracking_scan', scan.id);
      if (latest.pendingIds.includes(input.messageId))
        completeTrackingMessage(this.board, latest, input.messageId);
      return { evidence: existing };
    })();
  if (!scan.pendingIds.includes(input.messageId))
    throw new Error('Message is not in the pending scan page.');
  const message = verifiedGmail.parse(
    await this.connectors.call('gmail_get_message', { messageId: input.messageId }, signal),
  );
  authorize(this, capability, token, true);
  if (account(this) !== mailbox || message.id !== input.messageId)
    throw new Error('Gmail source identity changed.');
  const body = messageBody(message);
  if (!body.includes(input.quote))
    throw new Error('Evidence quotation must be an exact part of the fetched Gmail message.');
  const timestamp = Number(message.internalDate);
  if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > Date.now())
    throw new Error('Invalid Gmail evidence time.');
  return this.board.db.transaction(() => {
    const duplicate = this.board
      .list<TrackingSignal>('tracking_signal')
      .find((value) => value.id === id);
    if (duplicate) {
      const current = this.board.get<TrackingScan>('tracking_scan', scan.id);
      if (current.pendingIds.includes(input.messageId))
        completeTrackingMessage(this.board, current, input.messageId);
      return { evidence: duplicate };
    }
    const latest = this.board.get<TrackingScan>('tracking_scan', scan.id);
    if (!latest.pendingIds.includes(message.id))
      throw new Error('Scan message is no longer pending.');
    const candidates = this.board
      .list<Card>('card')
      .filter(
        (card) =>
          (normalizeApplicationText(card.company) === normalizeApplicationText(input.company) &&
            normalizeApplicationText(card.title) === normalizeApplicationText(input.title)) ||
          card.tracking?.gmailThreads.some(
            (link) => link.account === mailbox && link.threadId === message.threadId,
          ),
      );
    if (candidates.length > 50)
      throw new Error('Too many matching applications; narrow the application identity.');
    let evidence: TrackingSignal = {
      id,
      roleId: capability.roleId,
      runId: capability.runId,
      account: mailbox,
      source: 'gmail',
      messageId: message.id,
      threadId: message.threadId,
      subject:
        message.headers
          .find((value) => value.name.toLowerCase() === 'subject')
          ?.value.slice(0, 1000) ?? '',
      from:
        message.headers
          .find((value) => value.name.toLowerCase() === 'from')
          ?.value.slice(0, 1000) ?? '',
      quote: input.quote,
      sourceText: body.slice(0, 80000),
      sourceTruncated: !!message.textTruncated || !message.text.trim() || body.length > 80000,
      effectiveAt: new Date(timestamp).toISOString(),
      createdAt: new Date().toISOString(),
      company: input.company,
      title: input.title,
      state: input.state,
      candidateIds: candidates.map((card) => card.id),
      expectedCards: candidates.map(({ id: cardId, state, updatedAt }) => ({
        id: cardId,
        state,
        updatedAt,
      })),
      cardId: null,
      status: input.ignoreReason ? 'ignored' : 'pending',
      reason: input.ignoreReason ?? 'Review application identity and status evidence.',
    };
    const stableMatches = candidates.filter(
      (candidate) =>
        sourceMatches(candidate, body, mailbox, message.threadId) &&
        (candidate.tracking?.gmailThreads.some(
          (link) => link.account === mailbox && link.threadId === message.threadId,
        ) ||
          identityInSource(candidate.company, candidate.title, body)),
    );
    const card = stableMatches.length === 1 ? stableMatches[0] : undefined;
    const trustedMatch = !!card;
    if (!input.ignoreReason) {
      evidence.reason = evidence.sourceTruncated
        ? 'Fetched email is incomplete; review the source before deciding.'
        : !candidates.length
          ? 'No tracked application matches. Register it, then choose it here.'
          : !stableMatches.length
            ? 'No verified job URL, job identifier or linked Gmail thread matches. Confirm the application.'
            : stableMatches.length > 1
              ? 'The source matches multiple applications. Choose the correct application.'
              : sourceState(body) !== input.state || sourceState(input.quote) !== input.state
                ? 'Status language is uncertain, negative or conflicting. Review the full fetched email.'
                : evidence.reason;
    }
    if (
      !input.ignoreReason &&
      card &&
      trustedMatch &&
      message.text.trim() &&
      !message.textTruncated &&
      sourceState(input.quote) === input.state &&
      sourceState(body) === input.state
    ) {
      const conflict = trackingConflict(this.board, evidence, card);
      if (!conflict) evidence = applyTrackingSignal(this.board, evidence, card, capability.roleId);
      else evidence.reason = conflict;
    }
    if (evidence.status !== 'applied')
      this.board.record(
        'tracking_signal',
        evidence,
        capability.roleId,
        evidence.status === 'pending'
          ? 'Tracking evidence needs user review'
          : 'Ignored unrelated Gmail tracking message',
      );
    completeTrackingMessage(this.board, latest, message.id);
    if (evidence.status === 'pending') {
      const notification = this.addMessage(
        capability.roleId,
        capability.roleId,
        'user',
        `Application tracking needs your review: ${input.company} — ${input.title}. ${evidence.reason} Open the board to review the exact email evidence.`,
        card?.id ?? null,
        capability.runId,
      );
      this.board.record(
        'message',
        { ...notification, notification: 'attention' },
        capability.roleId,
        'Requested tracking review',
      );
    }
    return { evidence };
  })();
}
