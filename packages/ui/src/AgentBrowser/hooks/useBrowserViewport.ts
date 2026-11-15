import { useSyncExternalStore } from 'react';
export const useBrowserViewport = () => {
  return useSyncExternalStore(subscribe, visibleHeight);
};

// Reading the viewport forces a page layout, so it is read when it can change, never per render.
let height: number | undefined;
const read = () =>
  window.visualViewport?.scale === 1
    ? Math.min(window.innerHeight, window.visualViewport.height)
    : window.innerHeight;
const subscribe = (change: () => void) => {
  const update = () => {
    height = read();
    change();
  };
  update();
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
  return () => {
    window.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('resize', update);
  };
};
const visibleHeight = () => (height ??= read());
