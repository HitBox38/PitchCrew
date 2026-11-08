import type { BrowserAction, BrowserSnapshot, ComputerApproval } from '@pitchcrew/core';

/**
 * A page element in words for the compact tray: an inspected form control's label, or a plain
 * note for a selector generated from the agent's inspection. The exact selector stays in the
 * evidence views, where it is part of what the user approves.
 */
export const describePageElement = (selector: string, page?: BrowserSnapshot) => {
  const control = page?.controls?.find((item) => item.selector === selector);
  if (control?.label.trim()) return `${control.label.trim()} (${control.type || 'field'})`;
  // Generated from the agent's inspection: its reason already names the element.
  if (/^:nth-match\(/.test(selector)) return '';
  return selector;
};

/** Action fields; with the inspected page, the tray describes elements instead of selectors. */
export const actionFields = (action: BrowserAction, page?: BrowserSnapshot): [string, string][] => {
  if (action.kind === 'dialog')
    return [
      ['Decision', action.decision],
      ...(action.submissionAttemptId
        ? [['Submission attempt', action.submissionAttemptId] as [string, string]]
        : []),
    ];
  if (action.kind === 'navigate') return [['Destination', action.url]];
  const element = page ? describePageElement(action.selector, page) : action.selector;
  const fields: [string, string][] = element ? [['Page element', element]] : [];
  if (action.frame) fields.push(['Frame', action.frame]);
  if ('purpose' in action && action.purpose) fields.push(['Purpose', action.purpose]);
  if (action.kind === 'fill' || action.kind === 'select') fields.push(['Value', action.value]);
  if (action.kind === 'press') fields.push(['Key', action.key]);
  if (action.kind === 'upload') fields.push(['File', action.file]);
  if (action.kind === 'drag') fields.push(['Drop target', action.targetSelector]);
  if (action.kind === 'scroll')
    fields.push(
      ['Scroll horizontally', `${action.deltaX}px`],
      ['Scroll vertically', `${action.deltaY}px`],
    );
  return fields;
};

export const browserActionTitles: Record<BrowserAction['kind'], string> = {
  dialog: 'Resolve a browser dialog',
  navigate: 'Open a web page',
  click: 'Click a page element',
  hover: 'Hover over a page element',
  scroll: 'Scroll a page or container',
  drag: 'Drag a page element',
  fill: 'Enter text on a page',
  select: 'Choose an option',
  press: 'Press a key',
  upload: 'Upload an application file',
};
export const browserStatusLabels: Record<ComputerApproval['status'], string> = {
  pending: 'Needs approval',
  approved: 'Approved',
  rejected: 'Rejected',
  consumed: 'Executed',
  failed: 'Failed',
};

const approveVerbs: Record<BrowserAction['kind'], string> = {
  dialog: 'Approve answer',
  navigate: 'Approve opening',
  click: 'Approve click',
  hover: 'Approve hover',
  scroll: 'Approve scroll',
  drag: 'Approve drag',
  fill: 'Approve typing',
  select: 'Approve choice',
  press: 'Approve key press',
  upload: 'Approve upload',
};

/** The decision button names what will happen; a final submission says so. */
export const approveLabel = (action: BrowserAction) =>
  'purpose' in action && action.purpose === 'submission'
    ? 'Approve submission'
    : approveVerbs[action.kind];

/**
 * What the request will do, in words for the compact tray: "Open example.com", "Click “Learn more”",
 * "Type into Email". Empty when the page gave no name; the tray then leads with the agent's reason.
 */
const quote = (value: string, limit: number) => {
  const flat = value.replace(/\s+/g, ' ').trim();
  return `“${flat.length > limit ? `${flat.slice(0, limit - 1).trimEnd()}…` : flat}”`;
};

const pageHost = (url: string | undefined) => {
  try {
    return url ? new URL(url).host : '';
  } catch {
    return '';
  }
};

/**
 * What an approval will do, written by Pitchcrew rather than the agent: the verb, the exact value
 * typed, chosen or uploaded, and the inspected element's visible name. Without a name it says
 * where on the page, so the agent's own reason never stands in as the title.
 */
export const approvalSummary = (action: BrowserAction, page?: BrowserSnapshot) => {
  if (action.kind === 'navigate') {
    const host = pageHost(action.url);
    return host ? `Open ${host}` : browserActionTitles.navigate;
  }
  if (action.kind === 'dialog')
    return action.decision === 'accept'
      ? 'Accept the website dialog'
      : 'Dismiss the website dialog';
  if (action.kind === 'scroll') return 'Scroll the page';
  if (action.kind === 'press') return `Press ${action.key}`;
  const label =
    page?.controls?.find((item) => item.selector === action.selector)?.label.trim() ||
    page?.elements?.find((item) => item.ref === 'target')?.name.trim();
  const host = pageHost(page?.url);
  const target = label ? quote(label, 40) : '';
  const somewhere = host ? `an element on ${host}` : 'a page element';
  if (action.kind === 'fill') return `Type ${quote(action.value, 32)} into ${target || 'a field'}`;
  if (action.kind === 'select')
    return `Choose ${quote(action.value, 32)}${target ? ` in ${target}` : ''}`;
  if (action.kind === 'upload') return `Upload ${action.file}${target ? ` to ${target}` : ''}`;
  if (action.kind === 'click') return `Click ${target || somewhere}`;
  if (action.kind === 'hover') return `Hover over ${target || somewhere}`;
  return `Drag ${target || somewhere}`;
};
