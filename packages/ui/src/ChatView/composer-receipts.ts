import { api } from '@/api.ts';
import type { ChatSubmissionReceipt } from '@pitchcrew/core';
import { composerState, updateComposer, useComposerStore } from './composer-state.ts';

const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu;
const cursors = new Map<string, number>();
const checking = new Map<string, Promise<void>>();
let reads = 0;
const slots: (() => void)[] = [];
const acquire = async () => {
  if (reads >= 2) await new Promise<void>((resolve) => slots.push(resolve));
  else reads++;
  return () => {
    const next = slots.shift();
    if (next) next();
    else reads--;
  };
};

/** Read once after an ambiguous response. Never starts another model turn. */
export const findComposerReceipt = async (thread: string, clientRequestId: string) => {
  if (!uuid.test(clientRequestId)) return false;
  const release = await acquire();
  try {
    const { request } = await api<{ request: ChatSubmissionReceipt | null }>(
      `/conversations/${encodeURIComponent(thread)}/messages/receipts/${encodeURIComponent(clientRequestId)}`,
      'GET',
      undefined,
      AbortSignal.timeout(5000),
    );
    return request?.threadId === thread && request.submission?.id === clientRequestId;
  } catch {
    return false;
  } finally {
    release();
  }
};

/** Read-only reconciliation retires only the same saved drafts checked by this batch. */
export const reconcileComposerReceipts = async (thread?: string): Promise<void> => {
  if (!thread) {
    for (const id of Object.keys(useComposerStore.getState().threads))
      await reconcileComposerReceipts(id);
    return;
  }
  const active = checking.get(thread);
  if (active) return active;
  const work = async () => {
    const original = composerState(thread);
    const eligible = original.kept.filter((draft) => draft.payload.submission);
    if (!eligible.length) return;
    const start = (cursors.get(thread) ?? 0) % eligible.length;
    const selected = Array.from({ length: Math.min(20, eligible.length) }, (_, offset) =>
      eligible.at((start + offset) % eligible.length)!,
    );
    cursors.set(thread, (start + selected.length) % eligible.length);
    const accepted = new Map<string, string>();
    let next = 0;
    await Promise.all(
      Array.from({ length: 2 }, async () => {
        while (next < selected.length) {
          const draft = selected[next++];
          const id = draft.payload.submission!.id;
          if (await findComposerReceipt(thread, id)) accepted.set(draft.id, id);
        }
      }),
    );
    if (!accepted.size) return;
    updateComposer(thread, (current) => {
      const kept = current.kept.filter(
        (draft) =>
          !accepted.has(draft.id) || accepted.get(draft.id) !== draft.payload.submission?.id,
      );
      if (kept.length === current.kept.length) return current;
      const sameNotice =
        current.notice === original.notice &&
        current.receipt === original.receipt &&
        current.operation === original.operation;
      return {
        ...current,
        kept,
        notice:
          sameNotice && !kept.some((draft) => draft.payload.submission)
            ? 'Previously unconfirmed messages are saved in the conversation.'
            : current.notice,
      };
    });
  };
  const result = work().finally(() => checking.delete(thread));
  checking.set(thread, result);
  return result;
};
