import type { ViewerFile, ViewerSettings } from './types.ts';

/** Zoom presets in percent of actual size; − and + step through them from the shown scale. */
export const zoomPresets = [50, 75, 100, 125, 150, 200, 300, 400] as const;
export const minZoom = 25;
export const maxZoom = 400;
/** PDF points to CSS pixels: 100% shows a page at its printed size, as Word and browsers do. */
export const pdfToCss = 96 / 72;
/** Automatic fit never enlarges a portrait page past this, so a resume reads as paper. */
export const maxAutomaticScale = 1.25;

export type FitMode = ViewerSettings['fit'];

/** Fit modes each file kind offers in its zoom menu; Reset zoom and 100% give actual size. */
export const fitOptions = (kind: ViewerFile['kind']): { value: FitMode; label: string }[] =>
  kind === 'pdf'
    ? [
        { value: 'auto', label: 'Automatic' },
        { value: 'width', label: 'Fit width' },
        { value: 'page', label: 'Fit page' },
      ]
    : kind === 'docx'
      ? [
          { value: 'auto', label: 'Automatic' },
          { value: 'width', label: 'Fit width' },
        ]
      : kind === 'image'
        ? [{ value: 'width', label: 'Fit image' }]
        : [];

/** The base scale a fit mode gives a page of `page` size inside `room`. */
export const fitScale = (
  fit: FitMode,
  page: { width: number; height: number },
  room: { width: number; height: number },
) => {
  const width = Math.max(0.1, room.width / page.width);
  const whole = Math.max(0.1, Math.min(width, room.height / page.height));
  if (fit === 'width') return width;
  if (fit === 'page') return whole;
  if (fit === 'auto') return page.width > page.height ? whole : Math.min(width, maxAutomaticScale);
  return 1;
};

/** The percentage of actual size on screen: the fit's base scale times the zoom. */
export const shownZoom = (settings: Pick<ViewerSettings, 'zoom'>, base: number) =>
  Math.round(base * settings.zoom);

/**
 * The next preset above (direction 1) or below (−1) the shown scale, as an actual-size zoom. A fit
 * already past the last preset stays put rather than stepping the wrong way.
 */
export const steppedZoom = (shown: number, direction: 1 | -1) => {
  if (direction > 0 ? shown >= maxZoom : shown <= minZoom) return shown;
  const next =
    direction > 0
      ? zoomPresets.find((value) => value > shown + 0.5)
      : zoomPresets.findLast((value) => value < shown - 0.5);
  return Math.min(maxZoom, Math.max(minZoom, next ?? (direction > 0 ? maxZoom : minZoom)));
};
