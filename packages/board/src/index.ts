import type { PacketArtifact } from '@pitchcrew/core';
import {
  type Approval,
  type BoardEvent,
  type Card,
  type CardInput,
  type CardState,
  type Packet,
  type RuntimeId,
} from '@pitchcrew/core';
import { createBoardContext } from './board/context.ts';
import type { BoardContext } from './board/types.ts';

export { digestPacket, digestArtifacts } from './board/helpers.ts';
export {
  searchApplications,
  registerExternalApplication,
  isLikelyDuplicateApplication,
  registerExistingExternalSubmission,
  decideTrackingSignal,
  linkTrackingThread,
  unlinkTrackingThread,
  refreshTrackingSignal,
  updateTrackingIdentifier,
  latestTrackingTime,
  trackingConflict,
  applyTrackingSignal,
  completeTrackingMessage,
} from './board/tracking.ts';
export {
  setCardWeight,
  addCardLesson,
  removeCardLesson,
  mergeTags,
  boardInsights,
  statusSince,
  staleSubmissions,
  markStaleSubmissions,
} from './board/learning.ts';
export { previewApplicationImport, applyApplicationImport } from './board/imports.ts';
export {
  discoveryKeys,
  isKnownPosting,
  postingMatches,
  recordDiscoveredLeads,
  recordLinkedJob,
  type DiscoveredPosting,
} from './board/discovery.ts';
export class Board {
  private readonly context: BoardContext;
  constructor(filename: string) {
    this.context = createBoardContext(filename);
  }
  get db() {
    return this.context.db;
  }
  close(): void {
    return this.context.close();
  }
  list<T>(kind: BoardEvent['kind']): T[] {
    return this.context.list<T>(kind);
  }
  get<T>(kind: BoardEvent['kind'], id: string): T {
    return this.context.get<T>(kind, id);
  }
  record(
    kind: BoardEvent['kind'],
    data: BoardEvent['data'],
    actor: string,
    message: string,
  ): BoardEvent {
    return this.context.record(kind, data, actor, message);
  }
  events(limit?: number): BoardEvent[] {
    return this.context.events(limit);
  }
  history(entityId: string, before?: number, limit?: number): BoardEvent[] {
    return this.context.history(entityId, before, limit);
  }
  rebuild(): void {
    return this.context.rebuild();
  }
  createCard(input: CardInput, sample?: boolean): Card {
    return this.context.createCard(input, sample);
  }
  updateCard(
    id: string,
    patch: Partial<
      Pick<Card, 'packet' | 'feedback' | 'fit' | 'owner' | 'formAssessments' | 'submissionAttempts'>
    >,
    actor: string,
    message: string,
  ): Card {
    return this.context.updateCard(id, patch, actor, message);
  }
  move(id: string, state: CardState, actor: string, message?: string): Card {
    return this.context.move(id, state, actor, message);
  }
  requestApproval(cardId: string, artifacts?: PacketArtifact[]): Approval {
    return this.context.requestApproval(cardId, artifacts);
  }
  decideApproval(id: string, approved: boolean): Approval {
    return this.context.decideApproval(id, approved);
  }
  consumeApproval(id: string, cardId: string, digest: string): Packet {
    return this.context.consumeApproval(id, cardId, digest);
  }
  hasActiveRun(cardId: string): boolean {
    return this.context.hasActiveRun(cardId);
  }
  seedRoles(runtime?: RuntimeId, enabled?: boolean): void {
    return this.context.seedRoles(runtime, enabled);
  }
}
