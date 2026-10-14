import { useLayoutEffect, useRef, useState } from 'react';
import { useStickToBottomContext } from 'use-stick-to-bottom';
import type { TranscriptItem } from '../../ChatTurn/helpers.ts';
import { historyWindow } from '../history.ts';

export function useHistoryWindow(items: TranscriptItem[]) {
  const [anchor, setAnchor] = useState<string | null>(null);
  const navigation = useRef(false);
  const { stopScroll, scrollRef, scrollToBottom } = useStickToBottomContext();
  const page = historyWindow(items, anchor);
  const navigate = (next: string | null) => {
    stopScroll();
    navigation.current = true;
    setAnchor(next);
  };
  useLayoutEffect(() => {
    if (!navigation.current) return;
    navigation.current = false;
    if (page.latest) void scrollToBottom('instant');
    else if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [anchor, page.latest, scrollRef, scrollToBottom]);
  return { ...page, anchor, navigate };
}
