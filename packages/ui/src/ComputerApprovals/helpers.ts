import type { BrowserAction, ComputerApproval } from '@pitchcrew/core';
export const actionFields = (action: BrowserAction): [string, string][] => {
  if (action.kind === 'dialog')
    return [
      ['Decision', action.decision],
      ...(action.submissionAttemptId
        ? [['Submission attempt', action.submissionAttemptId] as [string, string]]
        : []),
    ];
  if (action.kind === 'navigate') return [['Destination', action.url]];
  const fields: [string, string][] = [['Page element', action.selector]];
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
