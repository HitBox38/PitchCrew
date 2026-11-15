import { useLayoutEffect } from 'react';
import { useMessageScroller } from '@pitchcrew/design-system/message-scroller';
import { landSendFlight, transcriptKey } from '../send-flight.ts';

/** Before first paint, so the message that receives the bubble never flashes in its slot. The
 * saved message lands it too if it arrived first, since it renders under the pending copy's key. */
export const useSendFlightLanding = (thread: string, messageId: string) => {
  const { scrollToMessage } = useMessageScroller();
  useLayoutEffect(
    () => landSendFlight(thread, transcriptKey(messageId), messageId, scrollToMessage),
    [thread, messageId, scrollToMessage],
  );
};
