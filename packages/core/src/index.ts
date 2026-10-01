import { z } from 'zod';
import { runtimeIds, type CardState, type RoleId, type RuntimeId } from './states.ts';

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
}
export interface Run {
  id: string;
  cardId: string;
  roleId: RoleId;
  runtime: RuntimeId;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  message: string;
  startedAt: string;
  finishedAt: string | null;
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
  version: 1;
  kind: 'card' | 'role' | 'run' | 'approval';
  entityId: string;
  actor: string;
  message: string;
  data: Card | Role | Run | Approval;
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
}
export const rolePatch = z.object({
  runtime: z.enum(runtimeIds),
  model: z.string().trim().max(100),
  enabled: z.boolean(),
  instructions: z.string().max(12000),
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
}
export interface RuntimeAdapter {
  id: RuntimeId;
  detect(): Promise<RuntimeHealth>;
  run(context: RunContext): Promise<RunResult>;
}
export function decodeEvent(raw: string): BoardEvent {
  const event = JSON.parse(raw) as BoardEvent;
  if (event.version !== 1) throw new Error(`Unsupported event version: ${event.version}`);
  return event;
}
