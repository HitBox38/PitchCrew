import type { ExternalMcpInfo } from '@pitchcrew/core';
import { useEffect, useRef, useState } from 'react';
import { configureExternalMcp, loadExternalMcp } from '../api.ts';

export const useExternalMcp = () => {
  const [info, setInfo] = useState<ExternalMcpInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const pollingEnabled = useRef(false);
  const [saved, setSaved] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const version = generation.current;
    const load = () =>
      loadExternalMcp(controller.signal)
        .then((result) => {
          if (!controller.signal.aborted && generation.current === version) {
            setInfo(result);
            pollingEnabled.current = result.enabled;
            setError('');
          }
        })
        .catch(() => {
          if (!controller.signal.aborted && generation.current === version)
            setError('Could not load external agent access. Check again to refresh it.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    void load();
    let reading = false;
    const timer = setInterval(() => {
      if (
        !pollingEnabled.current ||
        document.visibilityState !== 'visible' ||
        pending.current ||
        reading
      )
        return;
      reading = true;
      void load().finally(() => {
        reading = false;
      });
    }, 3000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [revision]);
  const refresh = () => {
    setLoading(true);
    setRevision((value) => value + 1);
  };
  const configure = async (enabled: boolean, write: boolean) => {
    if (loading || pending.current) return;
    pending.current = true;
    generation.current += 1;
    setSaving(true);
    setError('');
    setSaved('');
    try {
      setInfo(await configureExternalMcp(enabled, write));
      setSaved(
        enabled
          ? `Access saved: ${write ? 'job changes and crew messages' : 'read-only'}. Reconnect your apps.`
          : 'Access off. New calls are blocked. Work already queued can continue.',
      );
      setRevision((value) => value + 1);
    } catch (cause) {
      // A lost response can still have changed the grant; require a fresh read before another write.
      setInfo(null);
      pollingEnabled.current = false;
      setError(
        `${cause instanceof Error ? cause.message : 'Could not update external agent access.'} Access may have changed. Check again before changing it.`,
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  return { info, error, saved, busy: loading || saving, refresh, configure };
};
