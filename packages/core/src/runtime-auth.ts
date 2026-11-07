import type { RuntimeId } from './states.ts';

export interface RuntimeAuthMethod {
  id: string;
  label: string;
  kind: 'browser' | 'device' | 'code' | 'terminal' | 'credentials' | 'external';
  description?: string;
}
export type RuntimeAuthInteraction =
  | { id: string; type: 'browser'; url: string; requiresConsent?: boolean }
  | { id: string; type: 'device'; url: string; userCode: string }
  | { id: string; type: 'code'; label: string }
  | { id: string; type: 'terminal'; output: string; outputOffset?: number }
  | { id: string; type: 'credentials'; fields: { name: string; label: string; secret: boolean }[] };
export type RuntimeAuthResponse =
  | { type: 'browser'; action: 'open' | 'decline' }
  | { type: 'code'; code: string }
  | { type: 'terminal'; data: string; size?: { cols: number; rows: number } }
  | { type: 'credentials'; values: Record<string, string> };

/** User-only ephemeral sign-in state. Never include in events, snapshots or agent tools. */
export interface RuntimeAuthState {
  runtime: RuntimeId;
  supported: boolean;
  id: string | null;
  stage:
    | 'idle'
    | 'starting'
    | 'waiting'
    | 'verifying'
    | 'succeeded'
    | 'completed'
    | 'failed'
    | 'cancelled';
  detail: string;
  url?: string;
  codeRequested?: boolean;
  methods?: RuntimeAuthMethod[];
  canLogout?: boolean;
  credentialScope?: 'native' | 'workspace';
  configurationError?: string;
  methodId?: string;
  operation?: 'login' | 'logout';
  interaction?: RuntimeAuthInteraction;
  startedAt: string | null;
  expiresAt: string | null;
  finishedAt: string | null;
}
