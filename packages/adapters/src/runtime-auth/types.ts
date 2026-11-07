import type { RuntimeAuthInteraction, RuntimeAuthResponse } from '@pitchcrew/core';

export interface NativeSignInAction {
  url?: string;
  codeRequested?: boolean;
  interaction?: RuntimeAuthInteraction;
}
export interface NativeSignInOptions {
  command: string;
  prefix?: string[];
  signal: AbortSignal;
  onAction: (action: NativeSignInAction) => void;
  methodId?: string;
  env?: NodeJS.ProcessEnv;
  /** Fixture deadline override; production callers use the five-minute bound. */
  timeout?: number;
}
export interface NativeSignInProcess {
  completion: Promise<void>;
  respond: (code: string) => void;
  respondInteraction?: (response: RuntimeAuthResponse) => void;
}
