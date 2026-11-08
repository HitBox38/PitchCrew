import type { BrowserSessionInfo } from '@pitchcrew/core';

export const browserStatus = (
  session: BrowserSessionInfo | undefined,
  hasControl: boolean,
  waiting: boolean,
  thread: string,
) => {
  const manual = hasControl || !!session?.manual;
  const label = hasControl
    ? 'Your control'
    : session?.manual
      ? 'Paused'
      : waiting
        ? 'Needs approval'
        : session?.runId
          ? 'Browsing'
          : session?.status === 'open'
            ? 'Ready'
            : 'Closed';
  const elsewhere = !!session?.threadId && session.threadId !== thread;
  const detail = hasControl
    ? 'You’re controlling. Agent actions and inspection are paused.'
    : session?.manual
      ? 'Agent paused. Recover manual control to return it to the agent.'
      : waiting
        ? 'Waiting for your approval.'
        : session?.runId
          ? 'Agent browsing.'
          : session?.status === 'open'
            ? 'Browser ready.'
            : 'Browser closed.';
  return {
    label: `${label}${elsewhere ? ' elsewhere' : ''}`,
    manual,
    detail: `${detail}${elsewhere ? ' This browser belongs to another conversation. Open task details to see its source.' : ''}`,
  };
};

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
