import type { ComputerApproval } from '@pitchcrew/core';
import { browserErrorText } from '@pitchcrew/core/browser-errors';
import { browserModeLabels } from '@pitchcrew/core/browser-modes';

/** Who let the request run: the user, their browser mode, or a task site grant (no mode saved). */
const allowedBy = (approval: Pick<ComputerApproval, 'automatic' | 'mode'>) => {
  if (!approval.automatic) return 'You approved this request, but ';
  return approval.mode
    ? `${browserModeLabels[approval.mode]} allowed this request automatically, but `
    : 'This request was allowed automatically, but ';
};

/** Approval is a decision; a later execution failure does not reverse it. */
export const browserApprovalError = (
  approval: Pick<ComputerApproval, 'status' | 'error' | 'automatic' | 'mode' | 'action'>,
) => {
  const diagnostics = browserErrorText(approval.error);
  if (!diagnostics.trim()) return null;
  const firstLine = diagnostics.trim().split(/\r?\n/, 1)[0];
  if (approval.status !== 'failed') return { summary: firstLine, diagnostics };

  const timeout = /^page\.goto: Timeout (\d+)ms exceeded\.?$/.exec(firstLine);
  const result =
    approval.action.kind === 'navigate' && timeout
      ? `opening the page timed out after ${Number(timeout[1]) / 1000} seconds.`
      : 'the browser action failed.';
  return { summary: allowedBy(approval) + result, diagnostics };
};
