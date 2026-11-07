import { useCallback, useEffect, useRef, useState } from 'react';
import type { RuntimeAuthResponse, RuntimeId } from '@pitchcrew/core';
import { api } from '@/api.ts';

type TerminalResponse = Extract<RuntimeAuthResponse, { type: 'terminal' }>;
export const useAuthTerminalQueue = (runtime: RuntimeId, flowId: string, interactionId: string) => {
  const [error, setError] = useState('');
  const queue = useRef<TerminalResponse[]>([]);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    return () => {
      abort.abort();
      queue.current = [];
    };
  }, [flowId, interactionId]);
  const send = useCallback(
    (response: TerminalResponse) => {
      const signal = controller.current?.signal;
      if (!signal || signal.aborted) return;
      if (queue.current.length > 256) {
        queue.current = [];
        setError('Terminal input is moving too quickly. Cancel and retry sign-in.');
        return;
      }
      for (let offset = 0; offset < Math.max(1, response.data.length); offset += 4096)
        queue.current.push({ ...response, data: response.data.slice(offset, offset + 4096) });
      if (pending.current) return;
      pending.current = true;
      void (async () => {
        try {
          while (queue.current.length && !signal.aborted) {
            const response = queue.current.shift()!;
            await api(
              `/runtimes/${runtime}/auth/respond`,
              'POST',
              { flowId, interactionId, response },
              signal,
            );
          }
        } catch {
          queue.current = [];
          if (!signal.aborted)
            setError('The sign-in terminal could not receive input. Cancel and retry sign-in.');
        } finally {
          pending.current = false;
        }
      })();
    },
    [runtime, flowId, interactionId],
  );
  return { send, error };
};
