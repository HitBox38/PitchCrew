import { api } from '@/api.ts';
import type {
  RuntimeId,
  RuntimeModelCatalog,
  RuntimeModelPreferences,
  RuntimeModelPreferencesState,
} from '@pitchcrew/core';

export const loadRuntimeModels = (id: RuntimeId, signal?: AbortSignal) =>
  api<RuntimeModelPreferencesState>(`/runtimes/${id}/model-preferences`, 'GET', undefined, signal);
export const refreshRuntimeModels = (id: RuntimeId, refresh = true, signal?: AbortSignal) =>
  api<RuntimeModelCatalog>(`/runtimes/${id}/models`, 'POST', { refresh }, signal);
export const saveRuntimeModels = async (
  id: RuntimeId,
  preferences: RuntimeModelPreferences,
  revision: string,
) => {
  const result = await api<Pick<RuntimeModelPreferencesState, 'preferences' | 'revision'>>(
    `/runtimes/${id}/model-preferences`,
    'PUT',
    { preferences, revision },
  );
  window.dispatchEvent(
    new CustomEvent('pitchcrew-model-preferences-changed', {
      detail: { runtime: id, preferences: result.preferences },
    }),
  );
  return result;
};
