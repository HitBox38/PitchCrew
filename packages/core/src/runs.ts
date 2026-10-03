import { z } from 'zod';
import { packetSchema } from './packets.ts';
import { type RoleId, type RuntimeId } from './states.ts';

export interface Run {
  id: string;
  cardId: string | null;
  roleId: RoleId;
  runtime: RuntimeId;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  message: string;
  startedAt: string;
  finishedAt: string | null;
  mode?: 'workflow' | 'chat';
  rootRunId?: string;
  taskId?: string;
  threadId?: RoleId | 'crew';
  routineId?: string;
  scheduledFor?: string;
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
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
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
  }),
]);
export type RunResult = z.infer<typeof runResultSchema>;
