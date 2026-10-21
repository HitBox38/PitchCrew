import { externalUrlBlockReason } from '@pitchcrew/core/desktop-links';
import type { DesktopLinkBlockedReason } from '@pitchcrew/core';
import { workspaceToasts } from './toasts.ts';

export const showBlockedLinkToast = (reason: DesktopLinkBlockedReason) => {
  workspaceToasts.add({ title: messages[reason], type: 'error', timeout: 10000 });
};

export const blockUnsafeLink = (url: string) => {
  const reason = externalUrlBlockReason(url, window.location.href);
  if (!reason) return false;
  showBlockedLinkToast(reason);
  return true;
};

const messages: Record<DesktopLinkBlockedReason, string> = {
  'invalid-url': 'Link blocked: this is not a valid website address.',
  'embedded-credentials':
    'Link blocked: it contains a username or password. Remove those details before opening it.',
  'unsupported-protocol':
    'Link blocked: Pitchcrew opens only HTTP and HTTPS websites. File, script and app links are blocked.',
};
