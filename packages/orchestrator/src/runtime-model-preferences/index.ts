import { preferredRuntimeModels, type RuntimeId, type RuntimeModelCatalog } from '@pitchcrew/core';
import { RuntimeModelPreferencesStore, RuntimeModelPreferencesReadError } from './store.ts';

/** Includes hidden entries for saved-role validation; visibility affects pickers only. */
export const runtimeModelsWithCustomDefinitions = (
  directory: string,
  id: RuntimeId,
  catalog: RuntimeModelCatalog,
): RuntimeModelCatalog => {
  try {
    const { preferences } = new RuntimeModelPreferencesStore(directory).current(id);
    return {
      ...catalog,
      models: preferredRuntimeModels(catalog, preferences, { includeHidden: true }),
    };
  } catch (error) {
    if (error instanceof RuntimeModelPreferencesReadError) return catalog;
    throw error;
  }
};
