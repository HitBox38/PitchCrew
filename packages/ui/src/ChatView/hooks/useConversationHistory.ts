import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api.ts';
import { transcriptItems } from '@/ChatTurn/helpers.ts';
import type { ConversationHistoryPage } from '@pitchcrew/core';
import type { MessageTranscriptProps } from '../types.ts';
import { liveHistoryItems } from '../remote-history.ts';
import { useHistoryWindow } from './useHistoryWindow.ts';

export function useConversationHistory(props: MessageTranscriptProps) {
  const { thread, data, messages } = props;
  const remote = data.messageHistory !== undefined;
  const localItems = useMemo(
    () => (remote ? [] : transcriptItems(messages, data.runs, thread)),
    [remote, messages, data.runs, thread],
  );
  const local = useHistoryWindow(localItems);
  const [anchor, selectAnchor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{
    thread: string;
    anchor: string | null;
    page: ConversationHistoryPage;
  } | null>(null);
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  const revision = data.messageHistory?.revision;
  useEffect(() => {
    if (!remote) return;
    const controller = new AbortController();
    const query = anchor ? `?anchor=${encodeURIComponent(anchor)}` : '';
    void api<ConversationHistoryPage>(
      `/conversations/${thread}/history${query}`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((page) => {
        if (!controller.signal.aborted) {
          setError('');
          setLoaded({ thread, anchor, page });
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error ? failure.message : 'Could not load conversation history.',
          );
      });
    return () => controller.abort();
  }, [remote, thread, anchor, revision, attempt]);
  const saved = loaded?.thread === thread ? loaded.page : null;
  const displayedAnchor = saved ? loaded!.anchor : anchor;
  const navigate = (next: string | null) => {
    setError('');
    selectAnchor(next);
    retry((value) => value + 1);
  };
  const items = useMemo(
    () =>
      saved
        ? displayedAnchor === null
          ? liveHistoryItems(saved, data.streamingMessages, data.runs, thread)
          : saved.items
        : [],
    [saved, displayedAnchor, data.streamingMessages, data.runs, thread],
  );
  const total = saved ? Math.max(saved.total, saved.start + items.length) : 0;
  return remote
    ? {
        page: {
          ...(saved ?? { start: 0, end: 0, older: null, newer: null }),
          items,
          anchor: displayedAnchor,
          navigate,
          pending: displayedAnchor !== anchor && !error,
          latest: displayedAnchor === null,
        },
        total,
        loading: saved === null,
        error,
        retry: () => {
          setError('');
          retry((value) => value + 1);
        },
      }
    : { page: local, total: localItems.length, loading: false, error: '', retry: () => {} };
}
