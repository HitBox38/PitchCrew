import type { IpcMainInvokeEvent } from 'electron';

export const trustedUpdateSender = (
  event: IpcMainInvokeEvent,
  contents: { mainFrame: unknown },
  origin: string,
) => {
  if (event.sender !== contents || event.senderFrame !== contents.mainFrame || !event.senderFrame)
    return false;
  try {
    return new URL(event.senderFrame.url).origin === origin;
  } catch {
    return false;
  }
};

export const updateChannels = {
  state: 'pitchcrew:update:state',
  check: 'pitchcrew:update:check',
  download: 'pitchcrew:update:download',
  install: 'pitchcrew:update:install',
  changed: 'pitchcrew:update:changed',
} as const;
