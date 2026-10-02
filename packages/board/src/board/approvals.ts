import { type Approval, type Card, type Packet } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { digestPacket } from './helpers.ts';
import type { BoardContext } from './types.ts';

export function requestApproval(this: BoardContext, cardId: string): Approval {
  return this.db.transaction(() => {
    const card = this.get<Card>('card', cardId);
    if (card.state !== 'agreed' || !card.packet)
      throw new Error('A reviewed packet is required before requesting approval.');
    const approval: Approval = {
      id: randomUUID(),
      cardId,
      action: 'export_packet',
      packet: card.packet,
      digest: digestPacket(cardId, card.packet),
      status: 'pending',
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    this.record('approval', approval, 'user', 'Requested approval to export packet');
    this.move(cardId, 'awaiting_approval', 'user');
    return approval;
  })();
}
export function decideApproval(this: BoardContext, id: string, approved: boolean): Approval {
  return this.db.transaction(() => {
    const approval = this.get<Approval>('approval', id);
    if (approval.status !== 'pending') throw new Error('This approval has already been decided.');
    const card = this.get<Card>('card', approval.cardId);
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
    this.record(
      'approval',
      next,
      'user',
      approved ? 'Approved local packet export' : 'Rejected packet export',
    );
    if (!approved) this.move(approval.cardId, 'agreed', 'user');
    return next;
  })();
}
export function consumeApproval(
  this: BoardContext,
  id: string,
  cardId: string,
  digest: string,
): Packet {
  return this.db.transaction(() => {
    const approval = this.get<Approval>('approval', id);
    const card = this.get<Card>('card', cardId);
    if (
      approval.status !== 'approved' ||
      approval.cardId !== cardId ||
      approval.digest !== digest ||
      card.state !== 'awaiting_approval' ||
      !card.packet ||
      digestPacket(cardId, card.packet) !== digest
    )
      throw new Error('An unused approval for this exact packet is required.');
    this.record(
      'approval',
      { ...approval, status: 'consumed' },
      'mcp',
      'Consumed approval for local export',
    );
    return approval.packet;
  })();
}
