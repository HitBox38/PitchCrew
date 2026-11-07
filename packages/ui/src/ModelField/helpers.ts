import type { ModelFieldModel } from './types.ts';
import type { ManagedRuntimeModel } from '@pitchcrew/core';
export const modelStatus = ({ available, catalog, loading, error, value }: ModelFieldModel) => {
  if (!available)
    return catalog.modelSource === 'none'
      ? catalog.modelDetail
      : 'This runtime is unavailable. Install it before starting agent work.';
  if (loading) return 'Loading models from the runtime…';
  if (
    (catalog.models.find((model) => model.value === value) as ManagedRuntimeModel | undefined)
      ?.custom
  )
    return (
      error || 'Custom model selector. Availability and reasoning support have not been verified.'
    );
  return error || catalog.modelDetail;
};
