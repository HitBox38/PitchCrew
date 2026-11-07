import type { ModelFieldProps } from '@/ModelField/types.ts';
import { useModelCatalog } from './useModelCatalog.ts';

export const useModelField = ({
  id,
  runtime,
  available,
  initialCatalog,
  value,
  onValueChange,
}: ModelFieldProps) => {
  const { catalog, loading, error, refreshModels } = useModelCatalog(
    runtime,
    initialCatalog,
    value,
  );
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
};
