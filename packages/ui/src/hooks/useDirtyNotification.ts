import { useEffect } from 'react';

/** Editors retain their drafts; the host only needs a close/navigation guard. */
export const useDirtyNotification = (dirty: boolean, onDirtyChange?: (dirty: boolean) => void) => {
  // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-prop-callback-in-effect -- This publishes editor lifecycle state, including clearing the guard on unmount.
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
};
