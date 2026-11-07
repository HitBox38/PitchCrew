import { useState } from 'react';
import type { ChatRequest } from '@pitchcrew/core';

/** Keep the editing session mounted when its saved request begins delivery. */
export const useQueuedEditorSelection = (thread: string, requests: readonly ChatRequest[] = []) => {
  const [selection, setSelection] = useState<{ request: ChatRequest; session: number } | null>(
    null,
  );
  if (selection && selection.request.threadId !== thread) setSelection(null);
  const edit = (request: ChatRequest) =>
    setSelection((current) => ({ request, session: (current?.session ?? 0) + 1 }));
  const selected =
    selection?.request.threadId === thread &&
    (requests.find((request) => request.id === selection.request.id) ?? selection.request);
  return { selection, selected, edit };
};
