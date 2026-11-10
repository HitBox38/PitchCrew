import type { RemoteMcpInfo } from '@pitchcrew/core';
import { useEffect, useRef, useState } from 'react';
import { changeRemoteMcp, loadRemoteMcp } from '../api.ts';

export const useRemoteMcp = () => {
  const [info, setInfo] = useState<RemoteMcpInfo | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [savedFor, setSavedFor] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);
  const blocked = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(false);
  const recoverFocus = useRef(false);
  useEffect(() => {
    if (!uncertain || busy || !recoverFocus.current) return;
    recoverFocus.current = false;
    document.getElementById('remote-mcp-check')?.focus({ preventScroll: true });
  }, [uncertain, busy]);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const version = generation.current;
    let reading = false;
    const load = async () => {
      if (reading || pending.current) return;
      reading = true;
      try {
        const result = await loadRemoteMcp(
          AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        );
        if (controller.signal.aborted || version !== generation.current) return;
        setInfo(result);
        setError('');
        setUncertain(false);
        blocked.current = false;
      } catch {
        if (!controller.signal.aborted && version === generation.current)
          setError('Could not refresh remote connections. Check status to try again.');
      } finally {
        reading = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !blocked.current) void load();
    }, 2500);
    return () => {
      mounted.current = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [revision]);
  const refresh = () => {
    setLoading(true);
    setRevision((value) => value + 1);
  };
  const change = async (
    path: string,
    method: 'POST' | 'DELETE',
    body: unknown,
    message: string,
  ) => {
    if (pending.current || blocked.current || loading) return;
    pending.current = true;
    const version = ++generation.current;
    const trigger = document.activeElement;
    setBusy(path);
    setError('');
    setSaved('');
    try {
      const result = await changeRemoteMcp(path, method, body);
      if (mounted.current && version === generation.current) {
        setInfo(result);
        setSaved(message);
        setSavedFor(path);
        setRevision((value) => value + 1);
      }
    } catch (cause) {
      if (mounted.current && version === generation.current) {
        blocked.current = true;
        recoverFocus.current =
          trigger instanceof HTMLElement &&
          trigger !== document.body &&
          (document.activeElement === trigger || document.activeElement === document.body);
        setUncertain(true);
        setError(
          `${cause instanceof Error ? cause.message : 'Request not confirmed.'} Check status before trying another change.`,
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current && version === generation.current) setBusy('');
    }
  };
  return {
    info,
    error,
    saved,
    savedFor,
    loading,
    busy,
    disabled: loading || !!busy || uncertain,
    refresh,
    change,
  };
};
