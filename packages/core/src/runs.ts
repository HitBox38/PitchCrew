import { reviewAssessmentSchema } from './deep-reviews.ts';
import { z } from 'zod';
import { packetSchema } from './packets.ts';
import type { Role } from './roles.ts';
import type { Skill } from './skills.ts';
import { type RoleId, type RuntimeId } from './states.ts';

/** User-visible turn activity. Never contains private reasoning or raw tool payloads. */
export interface RunActivity {
  id: string;
  kind: 'commentary' | 'tool' | 'reasoning';
  label: string;
  text?: string;
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  startedAt: string;
  finishedAt: string | null;
}
export type RuntimeActivity = Pick<RunActivity, 'id' | 'kind' | 'label' | 'status' | 'text'>;
export interface Run {
  profileDigest?: string;
  purpose?:
    | 'source-extraction'
    | 'application-draft'
    | 'application-review'
    | 'fit'
    | 'deep-review';
  contextRevision?: string;
  deepReviewId?: string;
  deepReviewSelection?: boolean;
  reviewSubagentId?: string;
  reviewBudgetRequest?: boolean;
  /** Reserves a configured workflow seat; no provider execution or capability. */
  reviewSeatReservation?: boolean;
  reviewStage?: 'draft' | 'review' | 'correction' | 'recheck';
  id: string;
  cardId: string | null;
  roleId: RoleId;
  runtime: RuntimeId;
  status: 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  message: string;
  startedAt: string;
  finishedAt: string | null;
  mode?: 'workflow' | 'chat';
  rootRunId?: string;
  taskId?: string;
  threadId?: RoleId | 'crew';
  requestId?: string;
  memoryIds?: string[];
  activity?: RunActivity[];
  activityTruncated?: boolean;
  routineId?: string;
  scheduledFor?: string;
  configuration?: { role: Role; revision: string; skills: Skill[]; skillsRevision: string };
  inputPacketDigest?: string | null;
  outputPacketDigest?: string | null;
}
export interface AgentTask {
  id: string;
  parentRunId: string;
  rootRunId: string;
  roleId: RoleId;
  cardId: string | null;
  mode: 'chat' | 'workflow';
  trigger: 'message' | 'invoke';
  threadId: RoleId | 'crew';
  content: string;
  status: 'queued' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  runId: string | null;
  error: string;
  createdAt: string;
}
export const runResultSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('scout'),
    fit: z.number().int().min(0).max(100),
    reasons: z.array(z.string().max(1000)).max(10),
  }),
  z.object({ role: z.literal('writer'), packet: packetSchema }),
  z.object({
    role: z.literal('reviewer'),
    passed: z.boolean(),
    feedback: z.array(z.string().max(2000)).max(30),
    suggestions: z.array(z.string().max(2000)).max(60).optional(),
    assessment: reviewAssessmentSchema.optional(),
  }),
]);
export type RunResult = z.infer<typeof runResultSchema>;
