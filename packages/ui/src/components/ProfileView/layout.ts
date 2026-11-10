import type { MarkdownMode } from '@/components/MarkdownEditor/types.ts';

/** The editor frame's device-local layout: explorer width and visibility, and the citations rail. */
export interface ProfileLayout {
  explorerWidth: number;
  explorerOpen: boolean;
  citationsOpen: boolean;
  mode: MarkdownMode;
  /** Source mode: every Markdown mark stays visible instead of hiding away from the caret. */
  showSyntax: boolean;
}

export const explorerBounds = { min: 180, max: 420, initial: 240 } as const;
/** Windows at least this wide (a 1024px laptop included) open the explorer by default. */
export const wideQuery = '(min-width: 62rem)';
/** Split's two columns need a sheet at least this wide (40rem); narrower sheets show Write. */
export const splitMinimum = 640;
/** Below this width left for the note (26rem), the explorer opens over it as a drawer. */
export const overlayBelow = 416;
/** Windows at least this wide show the citations beside the note instead of in a popover. */
export const railQuery = '(min-width: 87.5rem)';
const key = 'pitchcrew.profile.layout';

export const clampExplorerWidth = (width: number) =>
  Math.round(Math.max(explorerBounds.min, Math.min(explorerBounds.max, width)));

export const defaultLayout = (wide: boolean): ProfileLayout => ({
  explorerWidth: explorerBounds.initial,
  explorerOpen: wide,
  citationsOpen: false,
  mode: 'write',
  showSyntax: false,
});

/** The layout saved on this device, or the defaults when nothing valid is stored. */
export const readLayout = (wide: boolean): ProfileLayout => {
  const fallback = defaultLayout(wide);
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!value || typeof value !== 'object') return fallback;
    const stored = value as Partial<Record<keyof ProfileLayout, unknown>>;
    return {
      explorerWidth:
        typeof stored.explorerWidth === 'number' && Number.isFinite(stored.explorerWidth)
          ? clampExplorerWidth(stored.explorerWidth)
          : fallback.explorerWidth,
      explorerOpen:
        typeof stored.explorerOpen === 'boolean' ? stored.explorerOpen : fallback.explorerOpen,
      citationsOpen:
        typeof stored.citationsOpen === 'boolean' ? stored.citationsOpen : fallback.citationsOpen,
      mode: ['write', 'split', 'preview'].includes(stored.mode as string)
        ? (stored.mode as MarkdownMode)
        : fallback.mode,
      showSyntax: typeof stored.showSyntax === 'boolean' ? stored.showSyntax : fallback.showSyntax,
    };
  } catch {
    return fallback;
  }
};

export const writeLayout = (layout: ProfileLayout) => {
  try {
    localStorage.setItem(key, JSON.stringify(layout));
  } catch {
    /* A per-device convenience only; the session keeps the layout in memory. */
  }
};

/** Where the draft holds this exact quote, or null once the draft no longer contains it. */
export const quoteRange = (content: string, quote: string) => {
  const start = quote ? content.indexOf(quote) : -1;
  return start < 0 ? null : { start, end: start + quote.length };
};

const autosaveKey = 'pitchcrew.profile.autosave';
/** Whether notes save shortly after typing stops on this device (on unless turned off). */
export const readAutosave = () => {
  try {
    return localStorage.getItem(autosaveKey) !== 'false';
  } catch {
    return true;
  }
};
export const writeAutosave = (enabled: boolean) => {
  try {
    localStorage.setItem(autosaveKey, String(enabled));
  } catch {
    /* This visit keeps the choice in memory. */
  }
};

/** The daemon's per-note limit, in characters. */
export const profileNoteLimit = 50000;
