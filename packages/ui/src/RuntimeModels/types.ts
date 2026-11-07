import type { RuntimeModelPreferences } from '@pitchcrew/core';
import type { useRuntimeModels } from './hooks/useRuntimeModels.ts';
export type RuntimeModelsModel = ReturnType<typeof useRuntimeModels>;
export type CustomRuntimeModel = RuntimeModelPreferences['custom'][number];
