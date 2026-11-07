import type { ChatRequest } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import { useQueuedMessage } from '../hooks/useQueuedMessage.ts';
import { QueuedMessageEditor } from './QueuedMessageEditor.tsx';

/** The editor outlives a queue row that starts delivery, keeping the unsaved correction visible. */
export const QueuedEditorSession = ({
  request,
  action,
  working,
  started,
}: {
  request: ChatRequest;
  action: Action;
  working: boolean;
  started: boolean;
}) => {
  const editor = useQueuedMessage(request, action, true);
  return (
    <QueuedMessageEditor request={request} editor={editor} working={working} started={started} />
  );
};
