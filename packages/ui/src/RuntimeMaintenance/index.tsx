import { useRuntimeUpdateChecks } from './hooks/useRuntimeUpdateChecks.ts';

export const RuntimeMaintenance = () => {
  useRuntimeUpdateChecks();
  return null;
};
