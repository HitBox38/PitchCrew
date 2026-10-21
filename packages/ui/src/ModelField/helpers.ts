import type { ModelFieldModel } from './types.ts';
export const modelStatus = ({ available, catalog, loading, error }: ModelFieldModel) => {
  if (!available)
    return catalog.modelSource === 'none'
      ? catalog.modelDetail
      : 'This runtime is unavailable. Install it before starting agent work.';
  if (loading) return 'Loading models from the runtime…';
  return error || catalog.modelDetail;
};
