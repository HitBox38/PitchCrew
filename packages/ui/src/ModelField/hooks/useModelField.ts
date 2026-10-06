import type { ModelFieldProps } from '@/ModelField/types.ts';
import { useModelCatalog } from './useModelCatalog.ts';

export function useModelField({
  id,
  runtime,
  available,
  initialCatalog,
  value,
  onValueChange,
}: ModelFieldProps) {
  const { catalog, loading, error, refreshModels } = useModelCatalog(runtime, initialCatalog);
  return {
    id,
    runtime,
    available,
    value,
    onValueChange,
    catalog,
    loading,
    refreshModels,
    error,
  };
}
