import type { DesktopUpdateState } from '@pitchcrew/core';
import type { AnalyticsEvent } from './types.ts';

/** Observe accepted main-process actions before installation can close the renderer. */
export const desktopUpdateEvent = (
  previous: DesktopUpdateState | null,
  next: DesktopUpdateState,
): AnalyticsEvent | undefined => {
  if (!previous || previous.status === next.status) return;
  if (next.status === 'downloading') return 'app_update_download_requested';
  if (next.status === 'installing') return 'app_update_install_requested';
};
