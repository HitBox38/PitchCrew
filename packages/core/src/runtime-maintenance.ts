import type { RuntimeId } from './states.ts';

export interface RuntimeAuthentication {
  status: 'authenticated' | 'missing' | 'unknown';
  detail: string;
  checkedAt: string;
  instructions: string;
  command?: string;
}
export interface RuntimeUpdateInfo {
  id: RuntimeId;
  status: 'unchecked' | 'current' | 'available' | 'unknown';
  installedVersion: string;
  latestVersion: string | null;
  checkedAt: string | null;
  lastSuccessAt: string | null;
  detail: string;
  installer: string;
  canUpdate: boolean;
  manualCommand: string;
  busyReasons?: string[];
  operation?: {
    id: string;
    stage: 'preparing' | 'updating' | 'verifying' | 'succeeded' | 'failed' | 'interrupted';
    startedAt: string;
    finishedAt: string | null;
    detail: string;
    output: string;
  };
}
export interface RuntimeMaintenanceState {
  enabled: boolean;
  automatic: boolean;
  checking: boolean;
  nextCheckAt: string | null;
  updates: RuntimeUpdateInfo[];
  authentication: { runtime: RuntimeId; model: string; result: RuntimeAuthentication }[];
}
