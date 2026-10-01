import { z } from 'zod';
import { runtimeIds, roleIds, type CardState, type RoleId, type RuntimeId } from './states.ts';

export * from './states.ts';
export const cardInput = z.object({
  company: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(160),
  location: z.string().trim().max(120).default('Remote'),
  url: z
    .union([
      z.literal(''),
      z
        .url()
        .refine(
          (v) => ['https:', 'http:'].includes(new URL(v).protocol),
          'Use an HTTP or HTTPS URL',
        ),
    ])
    .default(''),
  salary: z.string().trim().max(100).default(''),
  description: z.string().trim().max(20000).default(''),
  tags: z.array(z.string().max(40)).max(10).default([]),
});
export type CardInput = z.infer<typeof cardInput>;
export const packetSchema = z.object({
  resume: z.string().min(1).max(20000),
  coverLetter: z.string().min(1).max(12000),
  formAnswers: z.string().max(12000),
  note: z.string().max(5000),
  claims: z
    .array(
      z.object({
        claim: z.string().min(1).max(2000),
        source: z.string().min(1).max(200),
        quote: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(80),
});
export type Packet = z.infer<typeof packetSchema>;
export interface Card extends CardInput {
  id: string;
  state: CardState;
  fit: number | null;
  owner: RoleId | null;
  packet: Packet | null;
  feedback: string[];
  createdAt: string;
  updatedAt: string;
  sample: boolean;
}
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
  github: z.boolean().optional(),
  gmail: z.boolean().optional(),
  drive: z.boolean().optional(),
  calendar: z.boolean().optional(),
  sheets: z.boolean().optional(),
});
export type AgentCapabilities = z.infer<typeof capabilitySchema>;
export const defaultCapabilities: AgentCapabilities = {
  messageAgents: true,
  invokeAgents: true,
  manageWorkflow: true,
  github: false,
  gmail: false,
  drive: false,
  calendar: false,
  sheets: false,
};
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
}
export interface ChatMessage {
  id: string;
  threadId: RoleId | 'crew';
  from: RoleId | 'user' | 'system';
  to: RoleId | 'user' | 'crew';
  content: string;
  cardId: string | null;
  runId: string | null;
  createdAt: string;
}
export const chatInput = z.object({
  content: z.string().trim().min(1).max(8000),
  cardId: z.uuid().nullable().default(null),
  threadId: z.union([z.enum(roleIds), z.literal('crew')]).optional(),
});
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
export interface Approval {
  id: string;
  cardId: string;
  action: 'export_packet';
  digest: string;
  packet: Packet;
  status: 'pending' | 'approved' | 'rejected' | 'consumed';
  createdAt: string;
  decidedAt: string | null;
  exportDirectory?: string;
}
export interface BoardEvent {
  id: number;
  version: 1 | 2 | 3;
  kind: 'card' | 'role' | 'run' | 'approval' | 'message' | 'proposal' | 'task';
  entityId: string;
  actor: string;
  message: string;
  data: Card | Role | Run | Approval | ChatMessage | RoleProposal | AgentTask;
  createdAt: string;
}
export interface ProfileFile {
  name: string;
  content: string;
}
export interface RuntimeHealth {
  id: RuntimeId;
  available: boolean;
  version: string;
  detail: string;
}
export interface Snapshot {
  cards: Card[];
  roles: Role[];
  runs: Run[];
  approvals: Approval[];
  events: BoardEvent[];
  profile: ProfileFile[];
  runtimes: RuntimeHealth[];
  dataDirectory: string;
  demoAvailable: boolean;
  messages: ChatMessage[];
  proposals: RoleProposal[];
  tasks: AgentTask[];
  connectors: ConnectorStatus[];
}
export interface ConnectorStatus {
  id: 'github' | 'google';
  connected: boolean;
  account: string;
  services: string[];
  configured: boolean;
  pending: boolean;
  error: string;
}
export const rolePatch = z.object({
  runtime: z.enum(runtimeIds),
  model: z.string().trim().max(100),
  enabled: z.boolean(),
  instructions: z.string().max(12000),
  capabilities: capabilitySchema.optional(),
});
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
export interface RunContext {
  card: Card;
  role: Role;
  profile: ProfileFile[];
  directory: string;
  mcp: { command: string; args: string[]; env: Record<string, string> };
  signal: AbortSignal;
  onMessage: (message: string) => void;
  request?: string;
}
export interface RuntimeAdapter {
  id: RuntimeId;
  detect(): Promise<RuntimeHealth>;
  run(context: RunContext): Promise<RunResult>;
  chat(context: ChatContext): Promise<ChatResult>;
}
export interface ChatContext extends Omit<RunContext, 'card'> {
  card: Card | null;
  messages: ChatMessage[];
}
export const chatResultSchema = z.object({ reply: z.string().trim().min(1).max(12000) });
export type ChatResult = z.infer<typeof chatResultSchema>;
export function decodeEvent(raw: string): BoardEvent {
  const event = JSON.parse(raw) as BoardEvent;
  if (event.version !== 1 && event.version !== 2 && event.version !== 3)
    throw new Error(`Unsupported event version: ${event.version}`);
  return event;
}
