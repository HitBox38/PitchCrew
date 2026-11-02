/** The editor frame's device-local layout: explorer width and visibility, and the citations rail. */
export interface ProfileLayout {
  explorerWidth: number;
  explorerOpen: boolean;
  citationsOpen: boolean;
}

export const explorerBounds = { min: 180, max: 420, initial: 240 } as const;
/** Windows at least this wide open the explorer by default (the design system's `wide` threshold). */
export const wideQuery = '(min-width: 68.8125rem)';
/** Windows at least this wide show the citations beside the note instead of in a popover. */
export const railQuery = '(min-width: 87.5rem)';
const key = 'pitchcrew.profile.layout';

export const clampExplorerWidth = (width: number) =>
  Math.round(Math.max(explorerBounds.min, Math.min(explorerBounds.max, width)));

export const defaultLayout = (wide: boolean): ProfileLayout => ({
  explorerWidth: explorerBounds.initial,
  explorerOpen: wide,
  citationsOpen: false,
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

/** Selects and reveals a quote, including wrapped lines that the textarea cannot expose as DOM. */
export const selectQuote = (editor: HTMLTextAreaElement, quote: string) => {
  const range = quoteRange(editor.value, quote);
  if (!range) return false;
  editor.focus();
  editor.setSelectionRange(range.start, range.end);
  // Programmatic textarea selections do not scroll in Chromium. Measure the wrapped prefix in
  // an invisible, equally sized text box so the match is centered without changing the draft.
  const style = getComputedStyle(editor);
  const mirror = document.createElement('div');
  mirror.style.cssText =
    'position:fixed;left:-10000px;top:0;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;';
  for (const property of [
    'width',
    'box-sizing',
    'font',
    'line-height',
    'letter-spacing',
    'word-spacing',
    'padding',
    'border',
    'tab-size',
    'text-indent',
    'word-break',
  ])
    mirror.style.setProperty(property, style.getPropertyValue(property));
  mirror.textContent = editor.value.slice(0, range.start);
  const marker = document.createElement('span');
  marker.textContent = quote;
  mirror.append(marker);
  document.body.append(mirror);
  editor.scrollTop = Math.max(0, marker.offsetTop - editor.clientHeight / 2);
  mirror.remove();
  return true;
};
