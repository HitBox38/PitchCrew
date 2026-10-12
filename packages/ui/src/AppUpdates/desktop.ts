import type { DesktopUpdateBridge } from '@pitchcrew/core';

declare global {
  interface Window {
    pitchcrewUpdates?: DesktopUpdateBridge;
  }
}

export const desktopUpdateBridge = () =>
  typeof window === 'undefined' ? undefined : window.pitchcrewUpdates;
