import { useRef, useState } from 'react';
import type { ChatReference, ChatRequest } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import { referenceInputs } from '@/ChatComposer/helpers.ts';
import { canEditQueuedMessage } from '../queue-presentation.ts';

export const useQueuedMessage = (
  request: ChatRequest,
  action: Action,
  initiallyEditing = false,
) => {
  const [editing, setEditing] = useState(initiallyEditing);
  const [draft, setContent] = useState<string | null>(null);
  const content = draft ?? request.content;
  const [draftReferences, setReferences] = useState<ChatReference[] | null>(null);
  const references = draftReferences ?? request.references ?? [];
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
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
    if (inFlight.current) return;
    if (!canEditQueuedMessage(request)) {
      setError('This message has started. Send a correction in the conversation instead.');
      return;
    }
    inFlight.current = true;
    setSaving(true);
    try {
      if (await update('edit', { content, references: referenceInputs(content, references) }))
        cancel();
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  const cancel = () => {
    setContent(null);
    setReferences(null);
    setError('');
    setEditing(false);
  };
  const change = (text: string, references: ChatReference[]) => {
    setContent(text);
    setReferences(references);
  };
  const dirty =
    draft !== null &&
    (content !== request.content ||
      JSON.stringify(references) !== JSON.stringify(request.references ?? []));
  return {
    editing,
    setEditing,
    content,
    references,
    change,
    dirty,
    error,
    update,
    save,
    cancel,
    saving,
  };
};
