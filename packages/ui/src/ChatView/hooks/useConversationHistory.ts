import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api.ts';
import { transcriptItems, type TranscriptItem } from '@/ChatTurn/helpers.ts';
import type { ConversationHistoryPage } from '@pitchcrew/core';
import type { MessageTranscriptProps } from '../types.ts';
import { keepShownItems, liveHistoryItems } from '../remote-history.ts';
import { useHistoryWindow } from './useHistoryWindow.ts';

export const useConversationHistory = (props: MessageTranscriptProps) => {
  const { thread, data, messages } = props;
  const remote = data.messageHistory !== undefined;
  const localItems = useMemo(
    () =>
      remote
        ? []
        : transcriptItems(messages, data.runs, thread, {
            requests: data.chatRequests,
            tasks: data.tasks,
          }),
    [remote, messages, data.runs, data.chatRequests, data.tasks, thread],
  );
  const local = useHistoryWindow(localItems, props.focusRunId);
  const [anchor, selectAnchor] = useState<string | null>(
    props.focusRunId ? `turn-${props.focusRunId}` : null,
  );
  const [loaded, setLoaded] = useState<{
    thread: string;
    anchor: string | null;
    revision: string | undefined;
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
          setLoaded({ thread, anchor, revision, page });
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
  const following =
    displayedAnchor === null ||
    (displayedAnchor === `turn-${props.focusRunId}` && saved?.newer === null);
  const live = useMemo(
    () =>
      saved && following
        ? liveHistoryItems(saved, data.streamingMessages, data.runs, thread, {
            requests: data.chatRequests,
            tasks: data.tasks,
          })
        : null,
    [saved, following, data.streamingMessages, data.runs, data.chatRequests, data.tasks, thread],
  );
  // What the latest page showed, adjusted while rendering whenever the live entries change.
  const [shown, setShown] = useState<{
    thread: string;
    page: ConversationHistoryPage;
    live: TranscriptItem[];
    items: TranscriptItem[];
  } | null>(null);
  let current = live ? shown : null;
  if (saved && live && shown?.live !== live) {
    const previous = shown?.thread === thread ? shown : null;
    // A page fetched before the latest change cannot speak for what left the live data since.
    const untilRefetch = previous?.page === saved || loaded?.revision !== revision;
    current = {
      thread,
      page: saved,
      live,
      items: keepShownItems(previous?.items ?? [], live, untilRefetch),
    };
    setShown(current);
  } else if (!live && shown) setShown(null);
  const items = live && current ? current.items : (saved?.items ?? []);
  const kept = live ? items.length - live.length : 0;
  // Entries kept on the page; most sit above the newest window, so the page starts before it.
  const start = saved ? saved.start - kept : 0;
  const total = saved ? Math.max(saved.total, saved.start + items.length - kept) : 0;
  return remote
    ? {
        page: {
          ...(saved ?? { start: 0, end: 0, older: null, newer: null }),
          start,
          items,
          anchor: displayedAnchor,
          navigate,
          pending: displayedAnchor !== anchor && !error,
          latest: following,
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
};
