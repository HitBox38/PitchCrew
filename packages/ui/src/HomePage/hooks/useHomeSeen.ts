import { useEffect, useState } from 'react';
import { seenEveryMs, seenKey } from '../constants.ts';

type SeenStorage = Pick<Storage, 'getItem' | 'setItem'>;

const local = (): SeenStorage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** The stored "last here" time, or null when there is none or storage is unavailable. */
export const readSeen = (storage: SeenStorage | null = local()) => {
  try {
    return storage?.getItem(seenKey) ?? null;
  } catch {
    return null;
  }
};

/** Records that the user is here now; a blocked or full storage just keeps the old value. */
export const writeSeen = (at: Date, storage: SeenStorage | null = local()) => {
  try {
    storage?.setItem(seenKey, at.toISOString());
  } catch {
    /* Private windows and blocked site data: Since falls back to the last 24 hours. */
  }
};

/**
 * Whether the user is here, as `present()` reads it now, and the mark that follows them: `look`
 * moves it while they are here (the minute tick, or focus and visibility coming back), and `leave`
 * moves it once more the moment they stop being here, then never again until they are back. A
 * later hide, unload or unmount of a window they had already left, or of a Home mounted while
 * hidden, never moves it.
 */
export const seenTracker = (present: () => boolean, mark: () => void) => {
  let here = present();
  return {
    look: () => {
      here = present();
      if (here) mark();
    },
    leave: () => {
      if (here) mark();
      here = false;
    },
  };
};

const presentNow = () => document.visibilityState === 'visible' && document.hasFocus();
const seenNow = () => writeSeen(new Date());

/**
 * When the user was last here on this device, read once as Home mounts and kept for the visit, so
 * lines never vanish while they are read. The mark is the last moment Home was visible and focused:
 * it moves every minute while it is, and once when the window loses focus, the page hides or
 * unloads, or Home unmounts; a visible but unfocused window does not count as here.
 */
export const useHomeSeen = () => {
  const [seen] = useState(readSeen);
  useEffect(() => {
    const tracker = seenTracker(presentNow, seenNow);
    const tick = window.setInterval(tracker.look, seenEveryMs);
    const visibility = () =>
      document.visibilityState === 'hidden' ? tracker.leave() : tracker.look();
    window.addEventListener('focus', tracker.look);
    window.addEventListener('blur', tracker.leave);
    window.addEventListener('pagehide', tracker.leave);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('focus', tracker.look);
      window.removeEventListener('blur', tracker.leave);
      window.removeEventListener('pagehide', tracker.leave);
      document.removeEventListener('visibilitychange', visibility);
      tracker.leave();
    };
  }, []);
  return seen;
};
