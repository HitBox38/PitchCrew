import type { PacketArtifact } from '@pitchcrew/core';
import { type Approval, type Card, type Packet } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { digestPacket, digestArtifacts } from './helpers.ts';
import type { BoardContext } from './types.ts';
import { assertReviewedContext } from './application-context.ts';

export const requestApproval = (
  crewContext: BoardContext,
  cardId: string,
  artifacts?: PacketArtifact[],
  documentVerification?: Approval['documentVerification'],
): Approval => {
  return crewContext.db.transaction(() => {
    const card = crewContext.get<Card>('card', cardId);
    const context = assertReviewedContext(card);
    if (card.state !== 'agreed' || !card.packet)
      throw new Error('A reviewed packet is required before requesting approval.');
    const approval: Approval = {
      id: randomUUID(),
      cardId,
      action: 'export_packet',
      contextRevision: context.revision,
      ...(artifacts ? { artifacts, artifactDigest: digestArtifacts(artifacts) } : {}),
      ...(documentVerification ? { documentVerification } : {}),
      packet: card.packet,
      digest: digestPacket(cardId, card.packet),
      status: 'pending',
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    crewContext.record('approval', approval, 'user', 'Requested approval to export packet');
    crewContext.move(cardId, 'awaiting_approval', 'user');
    return approval;
  })();
};
export const decideApproval = (
  crewContext: BoardContext,
  id: string,
  approved: boolean,
): Approval => {
  return crewContext.db.transaction(() => {
    const approval = crewContext.get<Approval>('approval', id);
    if (approval.artifacts && approval.artifactDigest !== digestArtifacts(approval.artifacts))
      throw new Error('Reviewed artifacts changed.');
    if (approval.status !== 'pending') throw new Error('This approval has already been decided.');
    const card = crewContext.get<Card>('card', approval.cardId);
    const context = assertReviewedContext(card);
    if (approval.contextRevision !== context.revision)
      throw new Error('Application context changed. Request a new approval.');
    if (
      !card.packet ||
      card.state !== 'awaiting_approval' ||
      digestPacket(card.id, card.packet) !== approval.digest
    )
      throw new Error('The packet changed. Request a new approval.');
    const next: Approval = {
      ...approval,
      status: approved ? 'approved' : 'rejected',
      decidedAt: new Date().toISOString(),
    };
    crewContext.record(
      'approval',
      next,
      'user',
      approved ? 'Approved local packet export' : 'Rejected packet export',
    );
    if (!approved) crewContext.move(approval.cardId, 'agreed', 'user');
    return next;
  })();
};
export const consumeApproval = (
  crewContext: BoardContext,
  id: string,
  cardId: string,
  digest: string,
): Packet => {
  return crewContext.db.transaction(() => {
    const approval = crewContext.get<Approval>('approval', id);
    const card = crewContext.get<Card>('card', cardId);
    const context = assertReviewedContext(card);
    if (approval.contextRevision !== context.revision)
      throw new Error('Application context changed. Request a new approval.');
    if (approval.artifacts && approval.artifactDigest !== digestArtifacts(approval.artifacts))
      throw new Error('Reviewed artifacts changed.');
    if (
      approval.status !== 'approved' ||
      approval.cardId !== cardId ||
      approval.digest !== digest ||
      card.state !== 'awaiting_approval' ||
      !card.packet ||
      digestPacket(cardId, card.packet) !== digest
    )
      throw new Error('An unused approval for this exact packet is required.');
    crewContext.record(
      'approval',
      { ...approval, status: 'consumed' },
      'mcp',
      'Consumed approval for local export',
    );
    return approval.packet;
  })();
};
