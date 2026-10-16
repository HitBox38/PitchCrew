import { api } from '@/api.ts';
import { useEffect, useState } from 'react';

export function useHistorySearch(query: string, revision?: string) {
  const [result, setResult] = useState<{ query: string; threads: string[] }>({
    query: '',
    threads: [],
  });
  const [error, setError] = useState('');
  useEffect(() => {
    if (!query.trim() || revision === undefined) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setError('');
      void api<{ threads: string[] }>(
        `/conversations/search?q=${encodeURIComponent(query.trim())}`,
        'GET',
        undefined,
        controller.signal,
      )
        .then(({ threads }) => setResult({ query, threads }))
        .catch((failure) => {
          if (!controller.signal.aborted)
            setError(failure instanceof Error ? failure.message : 'Could not search messages.');
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, revision]);
  return { matches: result.query === query ? result.threads : [], error };
}
