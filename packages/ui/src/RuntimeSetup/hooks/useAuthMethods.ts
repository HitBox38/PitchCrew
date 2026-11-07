import { useEffect, useEffectEvent, useState } from 'react';
import type { RuntimeAuthMethod, RuntimeId } from '@pitchcrew/core';
import { api } from '@/api.ts';

export const useAuthMethods = (
  runtime: RuntimeId,
  visible: boolean,
  revision: number,
  settled: () => void,
) => {
  const notify = useEffectEvent(settled);
  const [state, setState] = useState<{ methods: RuntimeAuthMethod[] | null; error: string }>({
    methods: null,
    error: '',
  });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    void api<RuntimeAuthMethod[]>(
      `/runtimes/${runtime}/auth/methods`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((methods) => {
        if (!controller.signal.aborted) setState({ methods, error: '' });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({
            methods: null,
            error: 'Could not discover sign-in methods. Retry or configure credentials below.',
          });
      })
      .finally(() => {
        if (!controller.signal.aborted) notify();
      });
    return () => controller.abort();
  }, [runtime, visible, revision, retry]);
  return {
    ...state,
    loading: state.methods === null && !state.error,
    retry: () => setRetry((value) => value + 1),
  };
};
