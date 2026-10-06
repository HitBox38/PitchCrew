import type { RuntimeId, RuntimeModelCatalog } from '@pitchcrew/core';
import { useEffect, useEffectEvent, useState } from 'react';
import { loadModelCatalog } from '../api.ts';

export function useModelCatalog(runtime: RuntimeId, initialCatalog: RuntimeModelCatalog) {
  const [state, setState] = useState({
    runtime,
    catalog: initialCatalog,
    loading: runtime !== 'demo',
    error: '',
  });
  const [refresh, setRefresh] = useState(0);
  const getInitialCatalog = useEffectEvent(() => initialCatalog);
  useEffect(() => {
    if (runtime === 'demo') return;
    const fallback = getInitialCatalog();
    const controller = new AbortController();
    void loadModelCatalog(runtime, refresh > 0, controller.signal)
      .then((catalog) => {
        if (!controller.signal.aborted) setState({ runtime, catalog, loading: false, error: '' });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState((current) => ({
            runtime,
            catalog: current.runtime === runtime ? current.catalog : fallback,
            loading: false,
            error: 'Could not refresh models. Showing the last loaded choices.',
          }));
      });
    return () => controller.abort();
  }, [runtime, refresh]);
  const refreshModels = () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    setRefresh((count) => count + 1);
  };
  return {
    ...(state.runtime === runtime
      ? state
      : { catalog: initialCatalog, loading: runtime !== 'demo', error: '' }),
    refreshModels,
  };
}
