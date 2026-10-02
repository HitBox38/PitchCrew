import type { ModelFieldProps } from '@/ModelField/types.ts';
import { useEffect, useState } from 'react';
import { loadModelCatalog } from '../api.ts';

export function useModelField({
  id,
  runtime,
  available,
  initialCatalog,
  value,
  onValueChange,
}: ModelFieldProps) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [loading, setLoading] = useState(runtime !== 'demo');
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    if (runtime === 'demo') return;
    const controller = new AbortController();
    void loadModelCatalog(runtime, refresh > 0, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setCatalog(result);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Could not refresh models. Showing the last loaded choices.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [runtime, refresh]);
  return {
    id,
    runtime,
    available,
    value,
    onValueChange,
    catalog,
    loading,
    setLoading,
    setRefresh,
    error,
    setError,
  };
}
