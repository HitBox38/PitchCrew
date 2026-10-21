import { useState } from 'react';
import type { ChatRequest } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';

export const useQueuedMessage = (request: ChatRequest, action: Action) => {
  const [editing, setEditing] = useState(false);
  const [draft, setContent] = useState<string | null>(null);
  const content = draft ?? request.content;
  const [error, setError] = useState('');
  const update = async (command: string, extra = {}) => {
    setError('');
    try {
      await action(`/chat-requests/${request.id}`, 'PUT', { action: command, ...extra });
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update the queued message.');
      return false;
    }
  };
  const save = async () => {
    if (await update('edit', { content })) {
      setContent(null);
      setEditing(false);
    }
  };
  return { editing, setEditing, content, setContent, error, update, save };
};
