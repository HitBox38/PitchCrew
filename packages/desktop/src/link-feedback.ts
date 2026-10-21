import type { IpcRenderer } from 'electron';
import type { DesktopLinkBridge } from '../../core/src/desktop-links.ts';

export const linkFeedbackChannel = 'pitchcrew:link-blocked';

export const createLinkFeedbackBridge = (
  ipc: Pick<IpcRenderer, 'on' | 'removeListener'>,
): DesktopLinkBridge => ({
  subscribe: (listener) => {
    const receive = (_event: unknown, reason: unknown) => {
      if (
        reason === 'invalid-url' ||
        reason === 'embedded-credentials' ||
        reason === 'unsupported-protocol'
      )
        listener(reason);
    };
    ipc.on(linkFeedbackChannel, receive);
    return () => {
      ipc.removeListener(linkFeedbackChannel, receive);
    };
  },
});
