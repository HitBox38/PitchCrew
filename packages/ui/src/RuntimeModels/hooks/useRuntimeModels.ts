import { preferredRuntimeModels } from '@pitchcrew/core/runtime-model-preferences';
import { useEffect, useRef, useState } from 'react';
import {
  type RuntimeId,
  type RuntimeModelPreferences,
  type RuntimeModelPreferencesState,
} from '@pitchcrew/core';
import { loadRuntimeModels, refreshRuntimeModels, saveRuntimeModels } from '../api.ts';
import { ApiHttpError } from '@/api.ts';

export const useRuntimeModels = (id: RuntimeId) => {
  const [state, setState] = useState<RuntimeModelPreferencesState | null>(null);
  const [error, setError] = useState('');
  const [conflictReloaded, setConflictReloaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mutation = useRef(0);
  const reads = useRef(0);
  const [notice, setNotice] = useState('');
  const recoveryNeeded = state?.readError?.code === 'unreadable';
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  const orderedModels = state
    ? preferredRuntimeModels(state.catalog, state.preferences, { includeHidden: true })
    : [];
  const positions = new Map(orderedModels.map((model, index) => [model.value, index]));
  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      if (pending.current || document.visibilityState === 'hidden') return;
      const generation = mutation.current;
      const read = ++reads.current;
      void loadRuntimeModels(id, controller.signal)
        .then((value) => {
          if (
            !controller.signal.aborted &&
            generation === mutation.current &&
            read === reads.current
          ) {
            setState(value);
            setError('');
            setConflictReloaded(false);
          }
        })
        .catch((failure: unknown) => {
          if (
            !controller.signal.aborted &&
            generation === mutation.current &&
            read === reads.current
          )
            setError(failure instanceof Error ? failure.message : 'Could not load models.');
        });
    };
    // One discovery on opening; subsequent focus reads only load saved choices.
    void refreshRuntimeModels(id, false, controller.signal)
      .catch(() => {})
      .then(() => {
        if (!controller.signal.aborted) load();
      });
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', load);
    return () => {
      controller.abort();
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', load);
    };
  }, [id]);
  const perform = async (action: () => Promise<void>) => {
    if (pending.current) return false;
    pending.current = true;
    mutation.current++;
    setBusy(true);
    setError('');
    setConflictReloaded(false);
    try {
      await action();
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save model choices.');
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const save = (preferences: RuntimeModelPreferences) =>
    perform(async () => {
      if (!state || recoveryNeeded) throw new Error('Recover model choices before saving.');
      try {
        const result = await saveRuntimeModels(id, preferences, state.revision);
        setState({ ...state, ...result });
        setNotice('Saved');
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(''), 2000);
      } catch (failure) {
        if (failure instanceof ApiHttpError && failure.status === 409) {
          setState(await loadRuntimeModels(id));
          setConflictReloaded(true);
        }
        throw failure;
      }
    });
  const refresh = () =>
    perform(async () => {
      await refreshRuntimeModels(id);
      setState(await loadRuntimeModels(id));
    });
  const toggle = (field: 'favorite' | 'hidden', value: string) => {
    if (!state) return;
    const items = state.preferences[field];
    void save({
      ...state.preferences,
      [field]: items.includes(value) ? items.filter((item) => item !== value) : [...items, value],
    });
  };
  const move = (value: string, direction: -1 | 1) => {
    if (!state) return;
    const order = orderedModels.map((model) => model.value);
    const index = order.indexOf(value);
    const next = index + direction;
    if (!canMove(value, direction)) return;
    [order[index], order[next]] = [order[next], order[index]];
    void save({ ...state.preferences, order });
  };
  const canMove = (value: string, direction: -1 | 1) => {
    if (!state) return false;
    const index = positions.get(value) ?? -1;
    const target = orderedModels[index + direction];
    return (
      !!target &&
      state.preferences.favorite.includes(value) ===
        state.preferences.favorite.includes(target.value)
    );
  };
  const remove = (value: string) => {
    if (!state) return Promise.resolve(false);
    return save({
      custom: state.preferences.custom.filter((model) => model.value !== value),
      favorite: state.preferences.favorite.filter((item) => item !== value),
      hidden: state.preferences.hidden.filter((item) => item !== value),
      order: state.preferences.order.filter((item) => item !== value),
    });
  };
  const reload = () =>
    perform(async () => {
      setState(await loadRuntimeModels(id));
    });
  return {
    id,
    state,
    error,
    conflictReloaded,
    recoveryNeeded,
    notice,
    busy,
    save,
    refresh,
    reload,
    toggle,
    move,
    canMove,
    remove,
  };
};
