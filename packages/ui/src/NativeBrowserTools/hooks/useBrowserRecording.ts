import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { browserBlobBase64, recordBrowserPage } from '../media.ts';

export const useBrowserRecording = (id: string, tabId: string, leaseId: string | undefined) => {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ owner: string; blob: Blob; source: string } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const owner = `${id}:${tabId}`;
  const current = useRef(owner);
  const recorder = useRef<Awaited<ReturnType<typeof recordBrowserPage>> | null>(null);
  const starting = useRef(false);
  const mounted = useRef(true);
  const lease = useRef(leaseId);
  const clipUrl = useRef<string | null>(null);
  useLayoutEffect(() => {
    current.current = owner;
    lease.current = leaseId;
  }, [owner, leaseId]);
  const clip = result?.owner === owner ? result.blob : null;
  const source = result?.owner === owner ? result.source : '';
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      recorder.current?.stop();
      if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
    };
  }, []);
  useEffect(() => () => recorder.current?.stop(), [id, tabId, leaseId]);
  const start = async () => {
    const bridge = window.pitchcrewBrowser;
    if (!leaseId || !bridge?.capture || starting.current || recorder.current) return;
    const requested = current.current;
    starting.current = true;
    setBusy(true);
    setError('');
    setReviewing(false);
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
    clipUrl.current = null;
    setResult(null);
    setSaved(null);
    try {
      const session = await recordBrowserPage(async () => {
        if (!mounted.current || current.current !== requested || lease.current !== leaseId)
          throw new Error('Browser control changed.');
        return bridge.capture(id);
      });
      if (!mounted.current || current.current !== requested || lease.current !== leaseId)
        session.stop();
      recorder.current = session;
      if (mounted.current) setRecording(true);
      void session.done
        .then((blob) => {
          if (mounted.current && current.current === requested) {
            const source = URL.createObjectURL(blob);
            clipUrl.current = source;
            setResult({ owner: requested, blob, source });
            setReviewing(true);
          }
        })
        .catch((cause: unknown) => {
          if (mounted.current && current.current === requested)
            setError(cause instanceof Error ? cause.message : 'Recording failed.');
        })
        .finally(() => {
          if (recorder.current === session) recorder.current = null;
          if (mounted.current) setRecording(false);
        });
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error ? cause.message : 'Recording could not start.');
    } finally {
      starting.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const save = async () => {
    if (!clip) return;
    setBusy(true);
    setError('');
    try {
      const path = await window.pitchcrewBrowser!.saveArtifact(
        'webm',
        await browserBlobBase64(clip),
      );
      if (mounted.current) setSaved(path);
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error ? cause.message : 'Recording could not be saved.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return {
    recording,
    busy,
    clip,
    source,
    saved,
    error,
    reviewing: !!clip && reviewing,
    review: () => setReviewing(true),
    closeReview: () => setReviewing(false),
    discard: () => {
      if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
      clipUrl.current = null;
      setResult(null);
      setSaved(null);
      setReviewing(false);
    },
    start,
    stop: () => recorder.current?.stop(),
    save,
  };
};
