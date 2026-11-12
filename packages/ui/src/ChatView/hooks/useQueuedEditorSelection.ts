import { useState } from 'react';
import type { ChatRequest } from '@pitchcrew/core';
import { editorRequest } from '../helpers.ts';

/** Keep the editing session mounted when its saved request begins delivery. */
export const useQueuedEditorSelection = (thread: string, requests: readonly ChatRequest[] = []) => {
  const [selection, setSelection] = useState<{ request: ChatRequest; session: number } | null>(
    null,
  );
  if (selection && selection.request.threadId !== thread) setSelection(null);
  const edit = (request: ChatRequest) =>
    setSelection((current) => ({ request, session: (current?.session ?? 0) + 1 }));
  const fresh = selection && requests.find((request) => request.id === selection.request.id);
  // Remember the latest full copy, so a saved edit is not lost once the request settles.
  if (selection && fresh && !fresh.compact && fresh !== selection.request)
    setSelection({ ...selection, request: fresh });
  const selected =
    selection?.request.threadId === thread && editorRequest(selection.request, fresh ?? undefined);
  return { selection, selected, edit };
};
