import { useSyncExternalStore } from 'react';
export const useBrowserViewport = () => {
  return useSyncExternalStore(subscribe, visibleHeight);
};

const subscribe = (change: () => void) => {
  window.addEventListener('resize', change);
  window.visualViewport?.addEventListener('resize', change);
  return () => {
    window.removeEventListener('resize', change);
    window.visualViewport?.removeEventListener('resize', change);
  };
};
const visibleHeight = () =>
  window.visualViewport?.scale === 1
    ? Math.min(window.innerHeight, window.visualViewport.height)
    : window.innerHeight;
