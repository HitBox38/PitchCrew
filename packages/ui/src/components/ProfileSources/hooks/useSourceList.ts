import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProfileSource } from '@pitchcrew/core';
import { readSources } from '../api.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export const useSourceList = (open: boolean) => {
  const sourceRevision = useWorkspaceStore((state) => state.profileSources.revision);
  const [sources, setSources] = useState<ProfileSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [listError, setListError] = useState('');
  const revision = useRef(0);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const request = ++revision.current;
    setLoading(true);
    setListError('');
    try {
      const sources = await readSources(signal);
      if (!signal?.aborted && request === revision.current) {
        setSources(sources);
        setLoaded(true);
      }
    } catch (error) {
      if (!signal?.aborted && request === revision.current)
        setListError(error instanceof Error ? error.message : 'Could not load profile sources.');
    } finally {
      if (!signal?.aborted && request === revision.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) return refresh(controller.signal);
    });
    return () => controller.abort();
  }, [open, refresh, sourceRevision]);
  return { sources, loading, loaded, listError, refresh };
};
