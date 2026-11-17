import { reviewAssessmentSchema } from './deep-reviews.ts';
import { z } from 'zod';
import { packetChangeNotesSchema, packetReviewSummarySchema, packetSchema } from './packets.ts';
import type { Role } from './roles.ts';
import type { Skill } from './skills.ts';
import type { ReasoningLevel } from './reasoning.ts';
import type { ActivityToolKind } from './tool-activity.ts';
import type { ToolFailureReason } from './tool-failures.ts';
import { type RoleId, type RuntimeId } from './states.ts';

/**
 * User-visible turn activity. A tool step may carry its kind, one line of public detail (a
 * command, path, query, host or named target) and, once failed, a readable reason; all are
 * bounded and stripped of credentials before they are recorded. Never contains private
 * reasoning, browser input values or raw tool arguments and results.
 */
export interface RunActivity {
  id: string;
  kind: 'commentary' | 'tool' | 'reasoning';
  label: string;
  /** Commentary only. */
  text?: string;
  /** Tool steps: what kind of work, for the step's icon. Absent on older saved steps. */
  tool?: ActivityToolKind;
  /** Tool steps: the public target in one line. Never a browser input value. */
  detail?: string;
  /** Failed steps: why, in one bounded line. */
  error?: string;
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  startedAt: string;
  finishedAt: string | null;
}
/** A runtime's own tool call that failed, described only by closed words for diagnostics. */
export interface RuntimeToolFailure {
  reason: ToolFailureReason;
  /** A reviewed Pitchcrew MCP tool name, when a Pitchcrew call failed before the daemon saw it. */
  tool?: string;
}
export type RuntimeActivity = Pick<
  RunActivity,
  'id' | 'kind' | 'label' | 'status' | 'text' | 'tool' | 'detail' | 'error'
> & {
  /** Transient: never recorded in activity or shown; only reported as a closed diagnostic. */
  failure?: RuntimeToolFailure;
};
export interface Run {
  writingGuide?: Pick<import('./application-quality.ts').WritingGuide, 'revision' | 'preferences'>;
  writingCorrectionId?: string;
  documentRepair?: boolean;
  profileDigest?: string;
  purpose?:
    | 'source-extraction'
    | 'application-draft'
    | 'application-review'
    | 'fit'
    | 'packet-evaluation'
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
  /**
   * Effective model and reasoning, derived from `configuration.role` for compact views that omit
   * the configuration snapshot. Never stored in events; absent means the CLI default.
   */
  model?: string;
  reasoning?: ReasoningLevel;
  inputPacketDigest?: string | null;
  outputPacketDigest?: string | null;
}
/** Replace the bulky configuration snapshot with the effective model and reasoning it records. */
export const compactRun = ({ configuration, ...run }: Run): Run => ({
  ...run,
  ...(configuration?.role.model ? { model: configuration.role.model } : {}),
  ...(configuration?.role.reasoning ? { reasoning: configuration.role.reasoning } : {}),
});
export interface AgentTask {
  writingCorrectionId?: string;
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
  /** Delegation round membership; a delegate runs a subtask and the collection turn gathers results. */
  roundId?: string;
  roundPart?: 'delegate' | 'collection';
}
// Older runtime results remain accepted; the daemon supplies a factual activity fallback.
const changeSummary = z
  .string()
  .transform((text) => text.replace(/\s+/gu, ' ').trim())
  .pipe(z.string().min(1).max(300))
  .optional();
export const runResultSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('scout'),
    changeSummary,
    fit: z.number().int().min(0).max(100),
    packetFit: z
      .object({
        score: z.number().int().min(0).max(100),
        reasons: z.array(z.string().trim().min(1).max(1000)).min(1).max(10),
      })
      .strict()
      .optional(),
    reasons: z.array(z.string().max(1000)).max(10),
  }),
  z.object({
    role: z.literal('writer'),
    packet: packetSchema,
    changeSummary,
    changes: packetChangeNotesSchema.optional(),
  }),
  z.object({
    role: z.literal('reviewer'),
    changeSummary,
    passed: z.boolean(),
    feedback: z.array(z.string().max(2000)).max(30),
    suggestions: z.array(z.string().max(2000)).max(60).optional(),
    assessment: reviewAssessmentSchema.optional(),
    summary: packetReviewSummarySchema.optional(),
  }),
]);
export type RunResult = z.infer<typeof runResultSchema>;
