import {
  defaultRuntimeModelPreferences,
  preferredRuntimeModels,
} from '@pitchcrew/core/runtime-model-preferences';
import { type RuntimeId, type RuntimeModelCatalog } from '@pitchcrew/core';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { loadModelCatalog } from '../api.ts';
import { loadRuntimeModels } from '@/RuntimeModels/api.ts';

export const useModelCatalog = (
  runtime: RuntimeId,
  initialCatalog: RuntimeModelCatalog,
  selected = '',
) => {
  const [state, setState] = useState({
    runtime,
    catalog: initialCatalog,
    preferences: defaultRuntimeModelPreferences(),
    loading: runtime !== 'demo',
    error: '',
  });
  const [refresh, setRefresh] = useState(0);
  const preferencesGeneration = useRef(0);
  const reads = useRef(0);
  const getInitialCatalog = useEffectEvent(() => initialCatalog);
  useEffect(() => {
    if (runtime === 'demo') return;
    const fallback = getInitialCatalog();
    const controller = new AbortController();
    const generation = preferencesGeneration.current;
    void loadModelCatalog(runtime, refresh > 0, controller.signal)
      .then(({ catalog, preferences, warning }) => {
        if (!controller.signal.aborted)
          setState((current) => ({
            runtime,
            catalog,
            preferences:
              current.runtime === runtime && generation !== preferencesGeneration.current
                ? current.preferences
                : preferences,
            loading: false,
            error: warning,
          }));
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState((current) => ({
            runtime,
            catalog: current.runtime === runtime ? current.catalog : fallback,
            preferences:
              current.runtime === runtime ? current.preferences : defaultRuntimeModelPreferences(),
            loading: false,
            error: 'Could not refresh models. Showing the last loaded choices.',
          }));
      });
    return () => controller.abort();
  }, [runtime, refresh]);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (
        event as CustomEvent<{ runtime: RuntimeId; preferences: typeof state.preferences }>
      ).detail;
      if (detail?.runtime === runtime) {
        preferencesGeneration.current++;
        reads.current++;
        setState((current) => ({
          ...current,
          runtime,
          catalog: current.runtime === runtime ? current.catalog : getInitialCatalog(),
          preferences: detail.preferences,
        }));
      }
    };
    window.addEventListener('pitchcrew-model-preferences-changed', receive);
    const controller = new AbortController();
    const reload = () => {
      if (runtime === 'demo' || document.visibilityState === 'hidden') return;
      const generation = preferencesGeneration.current;
      const read = ++reads.current;
      void loadRuntimeModels(runtime, controller.signal)
        .then(({ preferences, catalog, readError }) => {
          if (
            !controller.signal.aborted &&
            generation === preferencesGeneration.current &&
            read === reads.current
          ) {
            preferencesGeneration.current++;
            setState((current) =>
              current.runtime === runtime
                ? { ...current, preferences, catalog, error: readError?.message ?? '' }
                : current,
            );
          }
        })
        .catch(() => {});
    };
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', reload);
    return () => {
      controller.abort();
      window.removeEventListener('pitchcrew-model-preferences-changed', receive);
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', reload);
    };
  }, [runtime]);
  const refreshModels = () => {
    preferencesGeneration.current++;
    reads.current++;
    setState((current) => ({ ...current, loading: true, error: '' }));
    setRefresh((count) => count + 1);
  };
  const current = state.runtime === runtime ? state.catalog : initialCatalog;
  const models = preferredRuntimeModels(
    current,
    state.runtime === runtime ? state.preferences : defaultRuntimeModelPreferences(),
    { selected },
  );
  return {
    ...(state.runtime === runtime
      ? state
      : { catalog: initialCatalog, loading: runtime !== 'demo', error: '' }),
    refreshModels,
    catalog: {
      ...current,
      models: models.map((model) =>
        model.custom ? { ...model, label: `${model.label} (custom)` } : model,
      ),
    },
  };
};
