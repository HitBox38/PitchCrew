import { useState, useSyncExternalStore } from 'react';
export const useBrowserPresentation = () => {
  const narrow = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panView, setPanView] = useState(false);
  return { narrow, expanded, setExpanded, zoom, setZoom, panView: zoom > 1 && panView, setPanView };
};

/**
 * Below 900px the panel becomes a sheet over the chat. Above it the split view stays, with the
 * sidebar folding to its rail while the browser is open below 1152px (useBrowserRail), so a half-
 * width 1920px window keeps chat and page side by side.
 */
const query = '(width < 56.25rem)';
const subscribe = (change: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
};
