import { recoverablePanel } from '@/LoadRecovery/index.tsx';
import { retryableLazy } from '@/lib/retryable-lazy.ts';

// Lazy panels retry a failed import on request and never reload the window on their own.
export const ConversationCreation = recoverablePanel(
  retryableLazy(() => import('@/ConversationCreation/index.tsx'), 'ConversationCreation'),
  'New conversation',
);

export const AddOpportunity = recoverablePanel(
  retryableLazy(() => import('@/components/AddOpportunity/index.tsx'), 'AddOpportunity'),
  'Add job',
);

export const CardDetails = recoverablePanel(
  retryableLazy(() => import('@/components/CardDetails/index.tsx'), 'CardDetails'),
  'Job details',
);

export const RoleSettings = recoverablePanel(
  retryableLazy(() => import('@/components/RoleSettings/index.tsx'), 'RoleSettings'),
  'Agent settings',
);

export const CommandPalette = retryableLazy(
  () => import('@/CommandPalette/index.tsx'),
  'CommandPalette',
);
