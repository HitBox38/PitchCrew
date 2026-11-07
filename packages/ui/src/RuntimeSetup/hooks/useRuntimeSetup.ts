import { useEffect, useRef, useState } from 'react';
import type {
  RuntimeAuthState,
  RuntimeId,
  RuntimeModelCatalog,
  RuntimeSetupInfo,
} from '@pitchcrew/core';
import { api } from '@/api.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { loadRuntimeSetup } from '../api.ts';
import { authInProgress, installInProgress } from '../helpers.ts';
import type { RuntimeSetupData, RuntimeSetupRequest } from '../types.ts';

export const useRuntimeSetup = (id: RuntimeId) => {
  const [data, setData] = useState<RuntimeSetupData | null>(null);
  const [catalog, setCatalog] = useState<RuntimeModelCatalog>();
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [requestWorking, setWorking] = useState(false);
  const [connectionWorking, setConnectionWorking] = useState(false);
  const [connectionDirty, setConnectionDirty] = useState(false);
  const [connectionRevision, setConnectionRevision] = useState(0);
  const working = requestWorking || connectionWorking;
  const [draft, setDraft] = useState<string | null>(null);
  const pending = useRef(false);
  const mutation = useRef(0);
  const requests = useRef<AbortController | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    requests.current = abort;
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (requestWorking) return;
    const abort = new AbortController();
    const generation = mutation.current;
    void loadRuntimeSetup(id, abort.signal)
      .then((result) => {
        if (!abort.signal.aborted && generation === mutation.current) {
          setData(result);
          setLoadError('');
        }
      })
      .catch((failure: unknown) => {
        if (!abort.signal.aborted && generation === mutation.current)
          setLoadError(
            failure instanceof Error ? failure.message : 'Could not load runtime setup.',
          );
      });
    return () => abort.abort();
  }, [id, retry, requestWorking]);
  const active = authInProgress(data?.auth) || installInProgress(data?.setup);
  useEffect(() => {
    if (requestWorking || (!active && !data?.setup.busyReasons.length)) return;
    const abort = new AbortController();
    const generation = mutation.current;
    let timer: ReturnType<typeof setTimeout>;
    const poll = () => {
      if (abort.signal.aborted) return;
      if (pending.current) {
        timer = setTimeout(poll, 1500);
        return;
      }
      void loadRuntimeSetup(id, abort.signal)
        .then((result) => {
          if (!abort.signal.aborted && generation === mutation.current) {
            setData(result);
            setLoadError('');
          }
        })
        .catch(() => {
          if (!abort.signal.aborted && generation === mutation.current)
            setLoadError('Connection interrupted. Retrying the progress check…');
        })
        .finally(() => {
          if (!abort.signal.aborted) timer = setTimeout(poll, 1500);
        });
    };
    timer = setTimeout(poll, 1500);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [id, active, data, requestWorking]);
  const completed = `${data?.setup.operation?.finishedAt ?? ''}:${data?.auth.finishedAt ?? ''}`;
  useEffect(() => {
    if (completed !== ':')
      void useWorkspaceStore
        .getState()
        .reload()
        .catch(() => {});
  }, [completed]);
  const request: RuntimeSetupRequest = async (suffix, body = {}, method = 'POST') => {
    const signal = requests.current?.signal;
    if (pending.current || !signal || signal.aborted) return false;
    pending.current = true;
    mutation.current++;
    setWorking(true);
    setError('');
    setLoadError('');
    try {
      const acknowledged = await api<RuntimeSetupInfo | RuntimeAuthState>(
        `/runtimes/${id}${suffix}`,
        method,
        body,
        signal,
      );
      if (signal?.aborted) return true;
      if (suffix.startsWith('/auth/'))
        setData((current) => current && { ...current, auth: acknowledged as RuntimeAuthState });
      else if (suffix === '/setup' || suffix.startsWith('/install'))
        setData((current) => current && { ...current, setup: acknowledged as RuntimeSetupInfo });
      try {
        setData(await loadRuntimeSetup(id, signal));
        await useWorkspaceStore.getState().reload();
      } catch {
        if (!signal?.aborted)
          setError(
            'Action accepted, but progress could not refresh. Retry connection to check its current state.',
          );
      }
      return true;
    } catch (failure) {
      if (!signal?.aborted)
        setError(failure instanceof Error ? failure.message : 'Could not complete runtime setup.');
      return false;
    } finally {
      pending.current = false;
      if (!signal?.aborted) setWorking(false);
    }
  };
  const path = draft ?? data?.setup.configuredPath ?? '';
  const dirty = draft !== null && draft.trim() !== (data?.setup.configuredPath ?? '');
  const savePath = async () => {
    if (await request('/setup', { executable: path.trim() || null }, 'PUT')) setDraft(null);
  };
  const connectionSaved = () => {
    setConnectionRevision((value) => value + 1);
    setRetry((value) => value + 1);
    void useWorkspaceStore
      .getState()
      .reload()
      .catch(() => {
        setError(
          'Authentication settings were saved, but workspace status could not refresh. Retry connection.',
        );
      });
  };
  return {
    data,
    catalog,
    setCatalog,
    error: error || loadError,
    working,
    connectionDirty,
    setConnectionDirty,
    setConnectionWorking,
    connectionRevision,
    connectionSaved,
    active,
    path,
    setDraft,
    dirty,
    savePath,
    request,
    refresh: () => setRetry((value) => value + 1),
    retry: () => {
      setError('');
      setRetry((value) => value + 1);
    },
  };
};
