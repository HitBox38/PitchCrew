import type {
  DeepReview,
  Packet,
  ProfileFile,
  Role,
  RuntimeDeadline,
  Skill,
} from '@pitchcrew/core';
export interface LiveDeepReview {
  id: string;
  runId: string;
  controller: AbortController;
  deadline: RuntimeDeadline;
  profile: ProfileFile[];
  profileRevision: number;
  profileDigest: string;
  contextRevision: string;
  expectedPacketDigest: string | null;
  reviewer: Role;
  writer: Role;
  skills: Map<string, Skill[]>;
  children: Map<string, { controller: AbortController; done: Promise<void> }>;
  stage: DeepReview['stage'];
  packet: Packet | null;
  budgetDecision?: Promise<unknown>;
  coordinatingRequested?: boolean;
}
export class ReviewWaiting extends Error {}
