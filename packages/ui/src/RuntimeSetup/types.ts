import type { RuntimeAuthState, RuntimeInfo, RuntimeSetupInfo } from '@pitchcrew/core';

export interface RuntimeSetupData {
  setup: RuntimeSetupInfo;
  auth: RuntimeAuthState;
}
export interface RuntimeSetupProps {
  runtime: RuntimeInfo;
  close: () => void;
}
export type RuntimeSetupRequest = (
  suffix: string,
  body?: unknown,
  method?: string,
) => Promise<boolean>;
export interface RuntimeSignInProps {
  runtime: RuntimeInfo;
  auth: RuntimeAuthState;
  request: RuntimeSetupRequest;
  working: boolean;
  active: boolean;
  busy: boolean;
  visible: boolean;
  onConnectionDirty: (dirty: boolean) => void;
  onConnectionWorking: (working: boolean) => void;
  connectionDirty: boolean;
  connectionRevision: number;
  onConnectionSaved: () => void;
  refreshSetup: () => void;
}
