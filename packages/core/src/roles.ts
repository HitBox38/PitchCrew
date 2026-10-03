import { z } from 'zod';
import { runtimeIds, type RoleId, type RuntimeId } from './states.ts';

export interface Role {
  id: RoleId;
  name: string;
  description: string;
  runtime: RuntimeId;
  model: string;
  enabled: boolean;
  instructions: string;
  capabilities?: AgentCapabilities;
}
export const capabilitySchema = z.object({
  messageAgents: z.boolean(),
  invokeAgents: z.boolean(),
  manageWorkflow: z.boolean(),
  manageRoutines: z.boolean().optional(),
  reviewPipeline: z.boolean().optional(),
  proposeCrewChanges: z.boolean().optional(),
  github: z.boolean().optional(),
  gmail: z.boolean().optional(),
  drive: z.boolean().optional(),
  calendar: z.boolean().optional(),
  sheets: z.boolean().optional(),
  computerUse: z.boolean().optional(),
});
export type AgentCapabilities = z.infer<typeof capabilitySchema>;
export const defaultCapabilities: AgentCapabilities = {
  messageAgents: true,
  invokeAgents: true,
  manageWorkflow: true,
  manageRoutines: true,
  reviewPipeline: false,
  proposeCrewChanges: false,
  github: false,
  gmail: false,
  drive: false,
  calendar: false,
  sheets: false,
  computerUse: false,
};
export const roleChanges = z
  .object({
    instructions: z.string().max(12000).optional(),
    capabilities: capabilitySchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Propose at least one change.');
export interface RoleProposal {
  id: string;
  roleId: RoleId;
  runId: string;
  reason: string;
  changes: z.infer<typeof roleChanges>;
  sourceRoleId?: RoleId;
  beforeRole?: Role;
  targetRevision?: string;
  pipelineReviewId?: string;
  findingId?: string;
  noticeMessageId?: string;
  status: 'pending' | 'applied' | 'rejected';
  createdAt: string;
}
export const rolePatch = z.object({
  runtime: z.enum(runtimeIds),
  model: z.string().trim().max(100),
  enabled: z.boolean(),
  instructions: z.string().max(12000),
  capabilities: capabilitySchema.optional(),
});
