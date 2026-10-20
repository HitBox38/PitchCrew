import { useEffect } from 'react';
import { startupTracker } from '../startup/index.ts';

/** Inside the view's Suspense boundary: commit means data and the lazy view are ready. */
export const StartupReady = () => {
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => void startupTracker.ready());
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return null;
};
