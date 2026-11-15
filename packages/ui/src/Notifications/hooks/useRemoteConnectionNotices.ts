import { useEffect } from 'react';
import type { RemoteMcpInfo } from '@pitchcrew/core';
import { api } from '@/api.ts';
import { useNotificationStore } from '../store.ts';

/** One reader in the notification center, shared by every bell and panel. */
export const useRemoteConnectionNotices = () => {
  useEffect(() => {
    const controller = new AbortController();
    let reading = false;
    const load = async () => {
      const store = useNotificationStore.getState();
      store.setRemoteRequests(
        store.remoteRequests.filter((request) => Date.parse(request.expiresAt) > Date.now()),
      );
      if (reading || document.visibilityState !== 'visible') return;
      reading = true;
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]);
        const info = await api<RemoteMcpInfo>('/remote-mcp', 'GET', undefined, signal);
        if (!signal.aborted)
          useNotificationStore
            .getState()
            .setRemoteRequests(
              info.requests.filter((request) => Date.parse(request.expiresAt) > Date.now()),
            );
      } catch {
        // Keep known requests only until their expiry while the daemon is unavailable.
      } finally {
        reading = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    document.addEventListener('visibilitychange', load);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
      useNotificationStore.getState().setRemoteRequests([]);
    };
  }, []);
};
