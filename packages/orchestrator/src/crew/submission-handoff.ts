import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assertReviewedContext, digestPacket, setCardStatus } from '@pitchcrew/board';
import type { Approval, Card, ChatRequest, Role } from '@pitchcrew/core';
import { matchingPacketExport, packetExportFiles } from '@pitchcrew/packet';
import type { CrewContext } from './types.ts';
import { createConversation } from './conversations.ts';
import { drainConversationQueue, saveRequest } from './conversation-queue.ts';
import { moveCard } from './cards.ts';

export const completeSubmission = (context: CrewContext, id: string, data: unknown): Card => {
  const { state } = z
    .object({ state: z.enum(['submitted', 'withdrawn']) })
    .strict()
    .parse(data);
  return context.board.db.transaction(() => {
    const approval = context.board.get<Approval>('approval', id);
    const card = context.board.get<Card>('card', approval.cardId);
    if (card.owner || context.board.hasActiveRun(card.id))
      throw new Error('Stop active application work before recording its outcome.');
    if (card.submissionAttempts?.some((attempt) => attempt.status === 'uncertain'))
      throw new Error('Verify the previous submission outcome first.');
    if (state === 'withdrawn') return setCardStatus(context.board, card.id, state);
    assertSubmissionPacket(context, approval);
    if (approval.status !== 'consumed' || !approval.exportDirectory)
      throw new Error('Export the approved packet before recording submission.');
    return moveCard(context, card.id, state);
  })();
};

export const assertSubmissionPacket = (context: CrewContext, approval: Approval): Card => {
  const card = context.board.get<Card>('card', approval.cardId);
  if (card.owner || context.board.hasActiveRun(card.id))
    throw new Error('Wait for active job work to finish.');
  if (card.submissionAttempts?.some((attempt) => attempt.status === 'uncertain'))
    throw new Error('Verify the previous submission outcome before continuing.');
  if (
    card.state !== 'awaiting_approval' ||
    !card.packet ||
    digestPacket(card.id, card.packet) !== approval.digest ||
    assertReviewedContext(card).revision !== approval.contextRevision
  )
    throw new Error('The application changed. Review and approve its current packet.');
  return card;
};

export const startSubmission = async (
  context: CrewContext,
  id: string,
  data: unknown,
): Promise<Approval> => {
  const input = z
    .discriminatedUnion('method', [
      z.object({ method: z.literal('manual') }).strict(),
      z.object({ method: z.literal('agent'), roleId: z.string().min(1).max(48) }).strict(),
    ])
    .parse(data);
  let approval = context.board.get<Approval>('approval', id);
  // An already-started handoff is an idempotent lookup, including while its run is active.
  if (approval.submission?.requestId) return approval;
  const initialCard = assertSubmissionPacket(context, approval);
  if (!['approved', 'consumed'].includes(approval.status))
    throw new Error('Approve this packet first.');
  const role = input.method === 'agent' ? context.board.get<Role>('role', input.roleId) : undefined;
  if (
    role &&
    (!role.enabled ||
      role.retiredAt ||
      !role.capabilities?.computerUse ||
      !role.capabilities?.assessForms ||
      !role.capabilities?.recordSubmissions)
  )
    throw new Error(
      'Choose an enabled agent with browser, form assessment and submission receipt tools.',
    );
  if (role && !context.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available))
    throw new Error('Install the selected agent runtime in Settings.');
  if (role) {
    let url: URL;
    try {
      url = new URL(initialCard.url);
    } catch {
      throw new Error('Add the employer application link in job details first.');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new Error('Use a valid public employer application link.');
  }
  if (
    approval.status === 'approved' ||
    (approval.status === 'consumed' && !approval.exportDirectory)
  )
    await context.exportPacket(id);
  approval = context.board.get<Approval>('approval', id);
  if (approval.status !== 'consumed' || !approval.exportDirectory)
    throw new Error('Export did not complete. Retry export before continuing.');
  if (
    !(await matchingPacketExport(
      approval.exportDirectory,
      packetExportFiles(approval.packet, approval.artifacts ?? []),
    ))
  )
    throw new Error('The exported files are missing. Request a fresh export approval.');
  const card = assertSubmissionPacket(context, approval);
  if (role) {
    const current = context.board.get<Role>('role', role.id);
    if (
      !current.enabled ||
      current.retiredAt ||
      !current.capabilities?.computerUse ||
      !current.capabilities?.assessForms ||
      !current.capabilities?.recordSubmissions ||
      current.runtime !== role.runtime
    )
      throw new Error('The selected agent setup changed. Review its settings and try again.');
  }
  const result = context.board.db.transaction(() => {
    if (!role) {
      const next: Approval = { ...approval, submission: { method: 'manual' } };
      context.board.record('approval', next, 'user', 'Chose manual application submission');
      return next;
    }
    // Dedicated job context prevents a previous chat's runtime overrides or recipients leaking in.
    const thread = createConversation(
      context,
      {
        title: `${card.company}: Submit application`.slice(0, 120),
        participants: [role.id],
        cardId: card.id,
      },
      'user',
      'application',
    );
    const request: ChatRequest = {
      id: randomUUID(),
      threadId: thread.id,
      messageId: randomUUID(),
      attachments: [],
      submissionApprovalId: approval.id,
      createdAt: new Date().toISOString(),
      order: Date.now(),
      content: `Prepare this job's application using the current reviewed and exported packet (approval ${approval.id}). Inspect the actual form and save its assessment. Ask me for missing personal answers; do not invent them. Check existing submission attempts to avoid duplicates. Use the existing browser supervision and ask me to approve the exact final submission action. After executing it, capture confirmation evidence and wait for my verification. Never retry an uncertain submission.`,
      deliveries: [{ roleId: role.id, status: 'queued', runId: null, error: '' }],
    };
    context.addMessage(
      thread.id,
      'user',
      role.id,
      request.content,
      card.id,
      null,
      request.messageId,
    );
    saveRequest(context, request);
    const next: Approval = {
      ...approval,
      submission: { method: 'agent', roleId: role.id, threadId: thread.id, requestId: request.id },
    };
    context.board.record('approval', next, 'user', 'Queued user-requested application preparation');
    return next;
  })();
  context.publishChat(true);
  void drainConversationQueue(context);
  return result;
};
