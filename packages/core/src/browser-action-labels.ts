import type { BrowserAction, BrowserSnapshot } from './computer.ts';

/**
 * A browser action in Pitchcrew's own words, in parts so a narrow tray can shorten the value and
 * never the target: "Type" “Ada Lovelace” "into" “Customer name”. Shared by the approval tray and
 * the chat's step labels; types only, so the renderer can import it.
 */
export interface BrowserActionParts {
  verb: string;
  /** The exact text, option or file the action uses; absent for clicks, keys and pages. */
  value?: string;
  joiner?: string;
  target: string;
}

const flat = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Keeps both ends of a long value, which tell values apart better than a prefix alone. */
export const middleTruncate = (value: string, limit: number) => {
  const text = flat(value);
  if (text.length <= limit) return text;
  const head = Math.ceil((limit - 1) / 2);
  return `${text.slice(0, head).trimEnd()}…${text.slice(text.length - (limit - 1 - head)).trimStart()}`;
};

const quoted = (value: string, limit: number) => `“${middleTruncate(value, limit)}”`;

const where = (url: string | undefined, path: boolean) => {
  try {
    if (!url) return '';
    const parsed = new URL(url);
    const rest = path ? `${parsed.pathname === '/' ? '' : parsed.pathname}` : '';
    return middleTruncate(`${parsed.host}${rest}`, 48);
  } catch {
    return '';
  }
};

/**
 * Text that may leave the approval review (chat activity, the chat heading, the tray's narration):
 * URLs shrink to their hostname (no userinfo, path, query or fragment) and long token-like runs
 * are dropped, before anything is shortened, so a secret can never survive as a kept part.
 */
export const publicText = (value: string) =>
  flat(value)
    .replace(/\bhttps?:\/\/\S+/gi, (url) => {
      try {
        return new URL(url).hostname;
      } catch {
        return '…';
      }
    })
    .replace(/[A-Za-z0-9+/_=-]{24,}/g, '…');

/**
 * The element a request names. The approval review may use an inspected control's label; public
 * labels use only the referenced element's name, which the daemon read with credential redaction.
 */
export const browserActionTargetName = (
  action: BrowserAction,
  page?: BrowserSnapshot,
  publicLabel = false,
) => {
  if (!('selector' in action)) return '';
  const redacted = page?.elements?.find((item) => item.ref === 'target')?.name.trim() ?? '';
  if (publicLabel) return redacted.includes('[hidden]') ? '' : publicText(redacted);
  return (
    page?.controls?.find((item) => item.selector === action.selector)?.label.trim() || redacted
  );
};

export const browserActionParts = (
  action: BrowserAction,
  page?: BrowserSnapshot,
  {
    values = true,
    path = true,
    publicLabel = false,
  }: { values?: boolean; path?: boolean; publicLabel?: boolean } = {},
): BrowserActionParts => {
  if (action.kind === 'navigate')
    return { verb: 'Open', target: where(action.url, path) || 'a web page' };
  if (action.kind === 'dialog')
    return {
      verb: action.decision === 'accept' ? 'Accept' : 'Dismiss',
      target: 'the website dialog',
    };
  if (action.kind === 'scroll') return { verb: 'Scroll', target: 'the page' };
  if (action.kind === 'press') return { verb: 'Press', target: action.key };
  const name = browserActionTargetName(action, page, publicLabel);
  const host = where(page?.url, false);
  const target = name ? quoted(name, 40) : '';
  const element = target || (host ? `an element on ${host}` : 'a page element');
  if (action.kind === 'fill')
    return values
      ? {
          verb: 'Type',
          value: quoted(action.value, 24),
          joiner: 'into',
          target: target || 'a field',
        }
      : { verb: 'Type', joiner: 'into', target: target || 'a field' };
  if (action.kind === 'select')
    return values
      ? {
          verb: 'Choose',
          value: quoted(action.value, 24),
          joiner: 'in',
          target: target || 'a list',
        }
      : { verb: 'Choose', target: target ? `an option in ${target}` : 'an option' };
  if (action.kind === 'upload')
    return { verb: 'Upload', value: action.file, joiner: 'to', target: target || 'the form' };
  if (action.kind === 'hover') return { verb: 'Hover over', target: element };
  if (action.kind === 'drag') return { verb: 'Drag', target: element };
  return { verb: 'Click', target: element };
};

export const joinBrowserActionParts = ({ verb, value, joiner, target }: BrowserActionParts) =>
  [verb, value, joiner, target].filter(Boolean).join(' ');

/** "Type “Ada Lovelace” into “Customer name”": what an approval will do. */
export const browserActionSummary = (action: BrowserAction, page?: BrowserSnapshot) =>
  joinBrowserActionParts(browserActionParts(action, page));

const pastVerbs: Record<string, string> = {
  Open: 'Opened',
  Accept: 'Accepted',
  Dismiss: 'Dismissed',
  Scroll: 'Scrolled',
  Press: 'Pressed',
  Type: 'Typed',
  Choose: 'Chose',
  Upload: 'Uploaded',
  'Hover over': 'Hovered over',
  Drag: 'Dragged',
  Click: 'Clicked',
};

/**
 * A finished step for chat activity, without the values the action typed or chose (activity
 * never carries browser inputs): "Clicked “Learn more”", "Typed into “Customer name”".
 */
export const browserActionDone = (action: BrowserAction, page?: BrowserSnapshot) => {
  const parts = browserActionParts(action, page, { values: false, path: false, publicLabel: true });
  return joinBrowserActionParts({ ...parts, verb: pastVerbs[parts.verb] ?? parts.verb });
};

/** A request the agent made, for chat activity: "Asked to click “Learn more”". */
export const browserActionAsked = (action: BrowserAction, page?: BrowserSnapshot) => {
  const text = browserActionPublic(action, page);
  return `Asked to ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
};

/** What a request will do, safe outside the approval review: no values, paths or raw labels. */
export const browserActionPublic = (action: BrowserAction, page?: BrowserSnapshot) =>
  joinBrowserActionParts(
    browserActionParts(action, page, { values: false, path: false, publicLabel: true }),
  );
