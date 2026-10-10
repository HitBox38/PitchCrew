import { useState } from 'react';
import { validateAttachments } from '../attachment-helpers.ts';
import type { ChatThread } from '../types.ts';

export function useChatAttachments(thread: ChatThread, setError: (message: string) => void) {
  const [drafts, setDrafts] = useState<Partial<Record<ChatThread, File[]>>>({});
  const files = drafts[thread] ?? [];
  const addFiles = (selected: File[]) => {
    const error = validateAttachments([...files, ...selected]);
    if (error) {
      setError(error);
      return;
    }
    setError('');
    setDrafts((current) => ({ ...current, [thread]: [...(current[thread] ?? []), ...selected] }));
  };
  const removeFile = (index: number) => {
    setError('');
    setDrafts((current) => ({
      ...current,
      [thread]: current[thread]?.filter((_, position) => position !== index),
    }));
  };
  const clearFiles = (sentThread: ChatThread) =>
    setDrafts((current) => ({ ...current, [sentThread]: [] }));
  return { files, addFiles, removeFile, clearFiles };
}
