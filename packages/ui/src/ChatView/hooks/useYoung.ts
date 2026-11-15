import { useEffect, useState } from 'react';

/**
 * True for an entry's first frame when it is new. A new transcript entry would otherwise lay out
 * at content-visibility's 10rem placeholder until the next frame, so the scroller pinned and
 * sized its spacer from the wrong height and corrected a frame later. Once rendered, the entry's
 * real size is remembered (`contain-intrinsic-size: auto`), so it can be skipped again.
 */
export const useYoung = (fresh: boolean) => {
  const [young, setYoung] = useState(fresh);
  useEffect(() => {
    if (!young) return;
    const frame = requestAnimationFrame(() => setYoung(false));
    return () => cancelAnimationFrame(frame);
  }, [young]);
  return young;
};
