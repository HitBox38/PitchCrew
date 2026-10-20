import { useRuntimeUpdateChecks } from './hooks/useRuntimeUpdateChecks.ts';

export function RuntimeMaintenance() {
  useRuntimeUpdateChecks();
  return null;
}
