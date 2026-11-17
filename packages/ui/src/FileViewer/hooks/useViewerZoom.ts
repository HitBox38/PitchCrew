import { useCallback, useState } from 'react';
import type { ViewerFile, ViewerSettings } from '../types.ts';
import { fitOptions, shownZoom, steppedZoom, type FitMode } from '../zoom.ts';

/**
 * Zoom as the reader sees it: renderers report the base scale their fit mode gives, the menu shows
 * the resulting percentage of actual size, and − / + step through presets from that percentage.
 */
export const useViewerZoom = (
  file: ViewerFile,
  settings: ViewerSettings,
  change: (patch: Partial<ViewerSettings>) => void,
) => {
  const [base, setBase] = useState<number | null>(null);
  const onScale = useCallback((scale: number) => setBase(scale), []);
  // Word Source is plain text: its zoom is the type size, with no page to fit.
  const options = file.kind === 'docx' && settings.mode === 'source' ? [] : fitOptions(file.kind);
  const fits = options.length > 0;
  const scale = fits && base ? base : 1;
  const shown = shownZoom(settings, scale);
  const setZoom = (percent: number) =>
    change(fits ? { fit: 'actual', zoom: percent } : { zoom: percent });
  return {
    onScale,
    /** Fit modes this view offers; none for text, where zoom is the type size. */
    options,
    /** Percentage of actual size on screen (type size for text files). */
    shown,
    fit: (file.kind === 'image' && settings.fit === 'auto' ? 'width' : settings.fit) as FitMode,
    setFit: (fit: FitMode) => change({ fit, zoom: 100 }),
    setZoom,
    zoomBy: (direction: 1 | -1) => setZoom(steppedZoom(shown, direction)),
    // A view without fit modes (text, Word Source) resets its type size and leaves the
    // file's fit (Word Preview's Automatic) alone.
    resetZoom: () => change(fits ? { zoom: 100, fit: 'actual' } : { zoom: 100 }),
    resetBase: () => setBase(null),
  };
};
