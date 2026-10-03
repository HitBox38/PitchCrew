import type { BrowserAction, ComputerApproval } from '@pitchcrew/core';

export const browserActionTitles: Record<BrowserAction['kind'], string> = {
  navigate: 'Open a web page',
  click: 'Click a page element',
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
export function actionFields(action: BrowserAction): [string, string][] {
  if (action.kind === 'navigate') return [['Destination', action.url]];
  const fields: [string, string][] = [['Page element', action.selector]];
  if (action.kind === 'fill' || action.kind === 'select') fields.push(['Value', action.value]);
  if (action.kind === 'press') fields.push(['Key', action.key]);
  if (action.kind === 'upload') fields.push(['File', action.file]);
  return fields;
}
