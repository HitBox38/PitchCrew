import { api } from '@/api.ts';
import type { RuntimeAuthState, RuntimeId, RuntimeSetupInfo } from '@pitchcrew/core';
import type { RuntimeSetupData } from './types.ts';

export const loadRuntimeSetup = async (
  id: RuntimeId,
  signal?: AbortSignal,
): Promise<RuntimeSetupData> => {
  const [setup, auth] = await Promise.all([
    api<RuntimeSetupInfo>(`/runtimes/${id}/setup`, 'GET', undefined, signal),
    api<RuntimeAuthState>(`/runtimes/${id}/auth`, 'GET', undefined, signal),
  ]);
  return { setup, auth };
};
