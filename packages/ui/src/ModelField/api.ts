import { api } from '@/api.ts';
import { defaultRuntimeModelPreferences } from '@pitchcrew/core/runtime-model-preferences';
import type { RuntimeId, RuntimeModelCatalog, RuntimeModelPreferencesState } from '@pitchcrew/core';

export const loadModelCatalog = async (
  runtime: RuntimeId,
  refresh: boolean,
  signal: AbortSignal,
) => {
  const [catalog, state] = await Promise.all([
    api<RuntimeModelCatalog>(`/runtimes/${runtime}/models`, 'POST', { refresh }, signal),
    api<RuntimeModelPreferencesState>(
      `/runtimes/${runtime}/model-preferences`,
      'GET',
      undefined,
      signal,
    ).catch((error: unknown) => {
      if (signal.aborted) throw error;
      return {
        preferences: defaultRuntimeModelPreferences(),
        readError: {
          message:
            'Saved model choices could not load. Native models are shown. Retry or open Settings > Runtimes.',
        },
      };
    }),
  ]);
  return { catalog, preferences: state.preferences, warning: state.readError?.message ?? '' };
};
