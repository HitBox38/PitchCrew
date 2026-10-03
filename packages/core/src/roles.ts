import { z } from 'zod';
import { isRoleId, roleIds, runtimeIds, type RoleId, type RuntimeId } from './states.ts';

export interface Role {
  id: RoleId;
  name: string;
  description: string;
  runtime: RuntimeId;
  model: string;
  enabled: boolean;
  instructions: string;
  workflow?: 'scout' | 'writer' | 'reviewer' | 'chat';
  retiredAt?: string | null;
  capabilities?: AgentCapabilities;
}
export const capabilitySchema = z.object({
  messageAgents: z.boolean(),
  invokeAgents: z.boolean(),
  manageWorkflow: z.boolean(),
  manageRoutines: z.boolean().optional(),
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
  status: 'pending' | 'applied' | 'rejected';
  createdAt: string;
}
export const roleIdSchema = z
  .string()
  .refine(isRoleId, 'Use a safe lowercase role ID (up to 48 characters).');
export const rolePatch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  workflow: z.enum([...roleIds, 'chat']).optional(),
  runtime: z.enum(runtimeIds),
  model: z.string().trim().max(100),
  enabled: z.boolean(),
  instructions: z.string().max(12000),
  capabilities: capabilitySchema.optional(),
});

export const roleCreate = rolePatch
  .extend({
    id: roleIdSchema,
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(500),
    workflow: z.enum([...roleIds, 'chat']).default('chat'),
  })
  .strict();
export const customCapabilities: AgentCapabilities = {
  ...defaultCapabilities,
  messageAgents: false,
  invokeAgents: false,
  manageWorkflow: false,
  manageRoutines: false,
};
