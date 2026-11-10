import { useLayoutEffect, useState } from 'react';
import { useMessageScroller } from '@pitchcrew/design-system/message-scroller';
import type { TranscriptItem } from '@/ChatTurn/helpers.ts';
import { pendingSendId, transcriptKey } from '../send-flight.ts';

/**
 * Pins a message the user just sent, as the scroller does for a new last entry: the agent's turn
 * often renders first, which leaves the message unpinned and the transcript shifting under it as
 * the reply arrives. A flight's copy is pinned by its landing instead, in step with its slide.
 */
export const usePinSent = (items: TranscriptItem[], opened: Set<string>) => {
  const { scrollToMessage } = useMessageScroller();
  const [pinned] = useState(() => new Set<string>());
  const sent = items.findLast(
    (item) =>
      item.kind === 'message' &&
      item.message.from === 'user' &&
      !opened.has(transcriptKey(item.id)),
  )?.id;
  // As the last entry the scroller pins it itself; pinning again would only force a layout.
  const last = items.at(-1)?.id === sent;
  useLayoutEffect(() => {
    const key = sent && transcriptKey(sent);
    if (!sent || !key || pinned.has(key)) return;
    pinned.add(key);
    // After the scroller's own mutation callback, which runs just before this microtask; anchored
    // as the scroller's own pin is, so it stays put as the reply grows or the turn reflows.
    if (!last && !pendingSendId(key))
      queueMicrotask(() =>
        scrollToMessage(sent, { align: 'start', behavior: 'auto', keepPreviousPeek: true }),
      );
  }, [sent, last, pinned, scrollToMessage]);
};
