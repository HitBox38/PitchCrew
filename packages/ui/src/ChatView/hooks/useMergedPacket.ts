import { useLayoutEffect } from 'react';
import type { ChatViewModel } from '../types.ts';

type MergedPacketProps = Pick<ChatViewModel, 'attached' | 'browserPanel' | 'dialog' | 'closePanel'>;

/** A job chat with a browser shows its packet as a tab of the browser
 * panel instead of a separate side panel, so the live page stays attached while reading. */
export const useMergedPacket = ({
  attached,
  browserPanel,
  dialog,
  closePanel,
}: MergedPacketProps) => {
  const merged = browserPanel.available && !!attached?.packet;
  const { showPacket } = browserPanel;
  useLayoutEffect(() => {
    if (!merged || dialog !== 'packet') return;
    showPacket();
    closePanel();
  }, [merged, dialog, showPacket, closePanel]);
  return merged;
};
