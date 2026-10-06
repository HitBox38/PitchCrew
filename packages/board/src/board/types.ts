import type { PacketArtifact } from '@pitchcrew/core';
import {
  type Approval,
  type BoardEvent,
  type Card,
  type CardInput,
  type CardState,
  type DefaultInstructionStatus,
  type Packet,
  type RuntimeId,
} from '@pitchcrew/core';
import Database from 'better-sqlite3';

export interface BoardContext {
  filename: string;
  db: Database.Database;
  close(): void;
  list<T>(kind: BoardEvent['kind']): T[];
  get<T>(kind: BoardEvent['kind'], id: string): T;
  record(
    kind: BoardEvent['kind'],
    data: BoardEvent['data'],
    actor: string,
    message: string,
  ): BoardEvent;
  events(limit?: number): BoardEvent[];
  history(entityId: string, before?: number, limit?: number): BoardEvent[];
  rebuild(): void;
  createCard(input: CardInput, sample?: boolean): Card;
  updateCard(
    id: string,
    patch: Partial<
      Pick<Card, 'packet' | 'feedback' | 'fit' | 'owner' | 'formAssessments' | 'submissionAttempts'>
    >,
    actor: string,
    message: string,
  ): Card;
  move(id: string, state: CardState, actor: string, message?: string): Card;
  requestApproval(cardId: string, artifacts?: PacketArtifact[]): Approval;
  decideApproval(id: string, approved: boolean): Approval;
  consumeApproval(id: string, cardId: string, digest: string): Packet;
  hasActiveRun(cardId: string): boolean;
  seedRoles(runtime?: RuntimeId, enabled?: boolean): void;
  defaultInstructionStatuses(): DefaultInstructionStatus[];
  instructionStatusCache?: { eventId: number; statuses: DefaultInstructionStatus[] };
}
