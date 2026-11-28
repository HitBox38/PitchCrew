import { api } from '@/api.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useEffect, useRef, useState } from 'react';

/** Whether this job's packet directory has saved files, and the action that opens it. */
export const usePacketFolder = (cardId: string, updatedAt: string) => {
  const [available, setAvailable] = useState(false);
  const [opening, setOpening] = useState(false);
  const [seen, setSeen] = useState(cardId);
  const openingRef = useRef(false);
  const mounted = useRef(true);
  if (seen !== cardId) {
    setSeen(cardId);
    setAvailable(false);
    setOpening(false);
  }
  useEffect(() => {
    openingRef.current = false;
  }, [cardId]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void api<{ available: boolean }>(
      `/cards/${cardId}/packet-folder`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setAvailable(result?.available === true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailable(false);
      });
    return () => controller.abort();
  }, [cardId, updatedAt]);
  const open = () => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    void api(`/cards/${cardId}/packet-folder`, 'POST')
      .catch((error: unknown) => {
        useWorkspaceStore
          .getState()
          .setToast(
            error instanceof Error ? error.message : 'Could not open the packet folder.',
            'error',
          );
      })
      .finally(() => {
        openingRef.current = false;
        if (mounted.current) setOpening(false);
      });
  };
  return { available, opening, open };
};
