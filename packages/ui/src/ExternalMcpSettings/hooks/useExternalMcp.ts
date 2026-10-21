import type { ExternalMcpInfo } from '@pitchcrew/core';
import { useEffect, useRef, useState } from 'react';
import { configureExternalMcp, loadExternalMcp } from '../api.ts';

export const useExternalMcp = () => {
  const [info, setInfo] = useState<ExternalMcpInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void loadExternalMcp(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setInfo(result);
          setError('');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Could not load external agent access.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  const refresh = () => {
    setLoading(true);
    setRevision((value) => value + 1);
  };
  const configure = async (enabled: boolean, write: boolean) => {
    if (loading || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      setInfo(await configureExternalMcp(enabled, write));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update external agent access.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  return { info, error, busy: loading || saving, refresh, configure };
};
