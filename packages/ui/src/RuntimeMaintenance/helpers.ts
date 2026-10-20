import type { RuntimeInfo, RuntimeUpdateInfo } from '@pitchcrew/core';

export const runtimeUpdateCount = (runtimes: RuntimeInfo[], updates: RuntimeUpdateInfo[] = []) => {
  const installed = new Set(
    runtimes
      .filter((runtime) => runtime.id !== 'demo' && (runtime.available || !!runtime.version))
      .map((runtime) => runtime.id),
  );
  return updates.filter((update) => installed.has(update.id) && update.status === 'available')
    .length;
};

export const runtimeStatus = (runtime: RuntimeInfo, update?: RuntimeUpdateInfo) => {
  if (runtime.id === 'demo') return { label: 'Scripted demo', tone: '' };
  if (!runtime.version) return { label: 'Not installed', tone: '' };
  if (!runtime.available) return { label: 'Incompatible version', tone: 'runtime-warning' };
  if (update?.operation && !update.operation.finishedAt) return { label: 'Updating', tone: '' };
  if (update?.status === 'available')
    return {
      label: `Update available${update.latestVersion ? `: ${update.latestVersion}` : ''}`,
      tone: 'runtime-available',
    };
  if (update?.status === 'current') return { label: 'Up to date', tone: 'success' };
  if (update?.status === 'unknown')
    return { label: 'Update check unavailable', tone: 'runtime-warning' };
  return { label: 'Installed', tone: '' };
};
