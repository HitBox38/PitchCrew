import { useState, useSyncExternalStore } from 'react';
export const useBrowserPresentation = () => {
  const narrow = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panView, setPanView] = useState(false);
  return { narrow, expanded, setExpanded, zoom, setZoom, panView: zoom > 1 && panView, setPanView };
};

// Matches the shared wide threshold in styles/theme.css.
const query = '(width < 68.8125rem)';
const subscribe = (change: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
};
