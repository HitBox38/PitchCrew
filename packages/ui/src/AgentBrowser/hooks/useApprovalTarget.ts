import { useEffect } from 'react';
import { setBrowserPresence } from '@/DesktopBrowserHost/presence.ts';
import { approvalTarget } from '../api.ts';

/**
 * Publishes where a waiting request's element sits, so the page overlay can ring it. The box is
 * read once per request from the daemon's memory; it clears when the request settles, while the
 * user holds control (the page may change under them) and when the panel unmounts.
 */
export const useApprovalTarget = (approvalId: string | undefined, show: boolean) => {
  useEffect(() => {
    if (!approvalId || !show) return;
    const controller = new AbortController();
    void approvalTarget(approvalId, controller.signal).then(
      ({ bounds }) => {
        if (!controller.signal.aborted) setBrowserPresence({ target: bounds });
      },
      () => {},
    );
    return () => {
      controller.abort();
      setBrowserPresence({ target: null });
    };
  }, [approvalId, show]);
};
