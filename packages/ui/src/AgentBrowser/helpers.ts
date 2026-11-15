export const remotePoint = (
  x: number,
  y: number,
  bounds: { left: number; top: number; width: number; height: number },
  frame: { width: number; height: number },
) => {
  return {
    x: Math.max(0, Math.min(frame.width, ((x - bounds.left) * frame.width) / bounds.width)),
    y: Math.max(0, Math.min(frame.height, ((y - bounds.top) * frame.height) / bounds.height)),
  };
};
export const touchScroll = (startY: number, endY: number, height: number, remoteHeight: number) => {
  return Math.max(-2000, Math.min(2000, ((startY - endY) * remoteHeight) / height));
};

/** An address split for display: the host carries the weight, the path stays quiet. */
export const addressParts = (url: string) => {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    const rest = `${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}${parsed.hash}`;
    return { host: parsed.host, rest };
  } catch {
    return null;
  }
};

/** An address bar entry as a URL: web addresses stay, bare hosts get https, the rest searches. */
export const normalizeAddress = (input: string) => {
  const value = input.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[^\s/]+\.[^\s]+$/.test(value)) return `https://${value}`;
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
};

/** A browser shortcut label for this platform, e.g. ⇧⌘R on macOS and Ctrl+Shift+R elsewhere. */
export const browserShortcut = (key: string, shift = false) => {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const upper = key.toUpperCase();
  return mac ? `${shift ? '⇧' : ''}⌘${upper}` : `Ctrl+${shift ? 'Shift+' : ''}${upper}`;
};

/** A tab's label: its page title, else the host it is loading or failed on, else New tab. */
export const browserTabLabel = (tab: { title?: string; url?: string; navigationUrl?: string }) => {
  const title = tab.title?.trim();
  if (title && !title.startsWith('about:blank')) return title;
  return addressParts(tab.navigationUrl ?? tab.url ?? '')?.host ?? 'New tab';
};

/** Arrow keys, Home and End move focus between visible tabs of a tab list (roving focus). */
export const moveTabFocus = (event: {
  key: string;
  currentTarget: HTMLElement;
  preventDefault: () => void;
}) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')].filter(
    (tab) => tab.getClientRects().length > 0,
  );
  const index = tabs.indexOf(document.activeElement as HTMLElement);
  if (index < 0 || !tabs.length) return;
  event.preventDefault();
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
};

/**
 * The scroll position that shows a tab wholly readable in a strip whose edges fade when there is
 * more beyond them: in content coordinates, the tab's span and the strip's width and content width.
 * It moves as little as possible and leaves a fade's width of the neighbour visible.
 */
export const revealScroll = ({
  start,
  end,
  scroll,
  width,
  content,
  fade,
}: {
  start: number;
  end: number;
  scroll: number;
  width: number;
  content: number;
  fade: number;
}) => {
  const max = Math.max(0, content - width);
  const readableStart = (at: number) => at + (at > 1 ? fade : 0);
  const readableEnd = (at: number) => at + width - (at < max - 1 ? fade : 0);
  let next = scroll;
  if (end > readableEnd(next)) next = Math.min(max, end + fade - width);
  if (start < readableStart(next)) next = Math.max(0, start - fade);
  return next;
};
