import type { RuntimeId } from './states.ts';

export interface RuntimeSetupOperation {
  id: string;
  stage:
    | 'preparing'
    | 'installing'
    | 'verifying'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
    | 'interrupted';
  startedAt: string;
  finishedAt: string | null;
  detail: string;
  output: string;
}

/** User-only setup diagnostics; provider credentials never enter this structure. */
export interface RuntimeSetupInfo {
  id: RuntimeId;
  configuredPath: string | null;
  executable: string | null;
  realPath: string | null;
  source: 'automatic' | 'custom' | 'managed';
  installer: string;
  canInstall: boolean;
  installDetail: string;
  busyReasons: string[];
  operation?: RuntimeSetupOperation;
}
