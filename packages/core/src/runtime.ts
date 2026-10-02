import type { Card } from './cards.ts';
import type { ChatMessage, ChatResult } from './chat.ts';
import type { Role } from './roles.ts';
import type { RunResult } from './runs.ts';
import type { Skill } from './skills.ts';
import { type RuntimeId } from './states.ts';
import type { ProfileFile } from './workspace.ts';

export interface RuntimeHealth {
  id: RuntimeId;
  available: boolean;
  version: string;
  detail: string;
}
export interface RuntimeModel {
  value: string;
  label: string;
}
export interface RuntimeModelCatalog {
  models: readonly RuntimeModel[];
  modelSource: 'runtime' | 'fallback' | 'none';
  modelDetail: string;
}
export interface RuntimeInfo extends RuntimeHealth, RuntimeModelCatalog {}
export interface RunContext {
  card: Card;
  role: Role;
  skills?: Skill[];
  profile: ProfileFile[];
  directory: string;
  mcp: { command: string; args: string[]; env: Record<string, string> };
  signal: AbortSignal;
  onMessage: (message: string) => void;
  request?: string;
}
export interface RuntimeAdapter {
  id: RuntimeId;
  models: readonly RuntimeModel[];
  listModels?(signal?: AbortSignal): Promise<readonly RuntimeModel[]>;
  detect(): Promise<RuntimeHealth>;
  run(context: RunContext): Promise<RunResult>;
  chat(context: ChatContext): Promise<ChatResult>;
}
export interface ChatContext extends Omit<RunContext, 'card'> {
  card: Card | null;
  messages: ChatMessage[];
  /** Current reply text, replacing the previous preview. Empty text clears it. */
  onReply?: (text: string) => void;
}
