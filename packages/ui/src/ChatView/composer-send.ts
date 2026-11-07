import type { Action } from '@/WorkspaceStore/types.ts';
import { ActionRefreshError } from '@/WorkspaceStore/action-errors.ts';
import { ApiHttpError } from '@/api-errors.ts';
import { referenceInputs } from '@/ChatComposer/helpers.ts';
import { encodeAttachment } from './api.ts';
import { findComposerReceipt } from './composer-receipts.ts';
import {
  acceptComposerSend,
  beginComposerSend,
  composerState,
  failComposerSend,
} from './composer-state.ts';

/** The store owns the request across route unmounts; errors never initiate another POST. */
export const sendComposerDraft = async (
  thread: string,
  action: Action,
  options: { intent?: 'queue' | 'interrupt'; roleIds?: string[] } = {},
) => {
  const current = composerState(thread).draft;
  if ((!current.text.trim() && !current.files.length) || current.text.trim().length > 8000)
    return false;
  const operation = beginComposerSend(
    thread,
    options.roleIds ? 'delegation' : 'message',
    options.intent,
  );
  if (!operation) return false;
  let beforePost = true;
  try {
    const body = options.roleIds
      ? { content: operation.payload.text.trim(), roleIds: options.roleIds }
      : {
          clientRequestId: operation.payload.submission!.id,
          content: operation.payload.text.trim(),
          references: referenceInputs(operation.payload.text, operation.payload.references),
          attachments: await Promise.all(operation.payload.files.map(encodeAttachment)),
          intent: operation.payload.submission!.intent,
        };
    beforePost = false;
    await action(
      `/conversations/${thread}/${options.roleIds ? 'delegate' : 'messages'}`,
      'POST',
      body,
      undefined,
      { errorToast: false },
    );
    acceptComposerSend(thread, operation.token);
    return true;
  } catch (error) {
    if (error instanceof ActionRefreshError) {
      acceptComposerSend(thread, operation.token, true);
      return true;
    }
    if (
      !beforePost &&
      !(error instanceof ApiHttpError && error.status < 500) &&
      operation.payload.submission &&
      (await findComposerReceipt(thread, operation.payload.submission.id))
    ) {
      acceptComposerSend(thread, operation.token, true);
      return true;
    }
    failComposerSend(
      thread,
      operation.token,
      error instanceof Error ? error.message : 'Request failed.',
      beforePost,
      error instanceof ApiHttpError ? error.status : undefined,
    );
    return false;
  }
};
