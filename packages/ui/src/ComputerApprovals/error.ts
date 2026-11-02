import type { ComputerApproval } from '@pitchcrew/core';
import { browserErrorText } from '@pitchcrew/core/browser-errors';

/** Approval is a decision; a later execution failure does not reverse it. */
export const browserApprovalError = (
  approval: Pick<ComputerApproval, 'status' | 'error' | 'automatic' | 'action'>,
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
  const decision = approval.automatic
    ? 'This request was allowed automatically, but '
    : 'You approved this request, but ';
  return { summary: decision + result, diagnostics };
};
