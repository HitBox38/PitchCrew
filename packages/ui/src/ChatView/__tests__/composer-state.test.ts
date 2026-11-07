import { beforeEach, expect, it, vi } from 'vitest';
import { ActionRefreshError } from '@/WorkspaceStore/action-errors.ts';
import type { Action } from '@/WorkspaceStore/types.ts';
import type { ChatReference } from '@pitchcrew/core';
import { chatReferenceInput } from '../../../../core/src/chat.ts';
import {
  acceptComposerSend,
  beginComposerSend,
  changeComposer,
  changeComposerFiles,
  composerState,
  consumeComposerHandoff,
  discardComposerDraft,
  offerComposerDraft,
  swapComposerDraft,
  useComposerStore,
} from '../composer-state.ts';
import { sendComposerDraft } from '../composer-send.ts';
import { encodeAttachment } from '../api.ts';
import { refreshComposerReceipt } from '../composer-recovery.ts';
import { findComposerReceipt } from '../composer-receipts.ts';
import { ApiHttpError } from '@/api-errors.ts';

vi.mock('../composer-receipts.ts', () => ({
  findComposerReceipt: vi.fn(async () => false),
  reconcileComposerReceipts: vi.fn(async () => {}),
}));

vi.mock('../api.ts', () => ({
  encodeAttachment: vi.fn(async (file: File) => ({ name: file.name, data: 'eA==' })),
}));
const reference: ChatReference = {
  kind: 'agent',
  id: 'scout',
  token: '@scout',
  label: 'Scout',
  start: 2,
  end: 8,
};
const initial = () => {
  const file = new File(['x'], 'first.txt');
  changeComposer('a', '  @scout hello', [reference]);
  changeComposerFiles('a', [file]);
  return file;
};
const deferred = () => {
  let resolve!: (value: unknown) => void, reject!: (error: unknown) => void;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
beforeEach(() => {
  useComposerStore.setState({ threads: {} });
  vi.mocked(encodeAttachment).mockClear();
  vi.mocked(findComposerReceipt).mockReset().mockResolvedValue(false);
});

it('atomically swaps a submitted payload and preserves new text/references/files after success', async () => {
  const first = initial(),
    request = deferred(),
    action = vi.fn<Action>(() => request.promise);
  const sending = sendComposerDraft('a', action);
  expect(composerState('a').draft.text).toBe('');
  expect(composerState('a').operation?.payload.files[0]).toBe(first);
  const next = new File(['next'], 'next.txt');
  changeComposer('a', '  @scout newer', [reference]);
  changeComposerFiles('a', [next]);
  await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  expect(action).toHaveBeenCalledTimes(1);
  const body = action.mock.calls[0]![2] as {
    content: string;
    references: unknown[];
    attachments: unknown[];
  };
  expect(body.content).toBe('@scout hello');
  expect(chatReferenceInput.parse(body.references[0])).toMatchObject({ start: 0, end: 6 });
  expect(action.mock.calls[0]![4]).toEqual({ errorToast: false });
  expect(await sendComposerDraft('a', action)).toBe(false);
  request.resolve({ id: 'accepted' });
  await sending;
  expect(composerState('a').draft).toMatchObject({
    text: '  @scout newer',
    references: [reference],
  });
  expect(composerState('a').draft.files[0]).toBe(next);
  expect(composerState('a').operation).toBeUndefined();
});

it('keeps every failed submitted payload separate and swaps without dropping the current draft', async () => {
  const file = initial(),
    reject = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
  await sendComposerDraft('a', reject);
  expect(composerState('a').draft.text).toBe('');
  expect(composerState('a').kept[0]?.payload.files[0]).toBe(file);
  changeComposer('a', 'second draft', []);
  await sendComposerDraft('a', reject);
  expect(composerState('a').kept).toHaveLength(2);
  changeComposer('a', 'third unsent draft', []);
  const id = composerState('a').kept[0]!.id;
  swapComposerDraft('a', id);
  expect(composerState('a').draft.text).toBe('  @scout hello');
  expect(composerState('a').draft.references).toEqual([reference]);
  expect(composerState('a').draft.files[0]).toBe(file);
  expect(composerState('a').kept.map((draft) => draft.payload.text)).toEqual([
    'second draft',
    'third unsent draft',
  ]);
  expect(reject).toHaveBeenCalledTimes(2);
});

it('preserves uncertainty when restored sends are displaced by another draft or a prefill', async () => {
  initial();
  const action = vi.fn<Action>(async () => {
    throw new TypeError('Response lost');
  });
  await sendComposerDraft('a', action, { intent: 'interrupt' });
  const original = composerState('a').kept[0]!;
  swapComposerDraft('a', original.id);
  offerComposerDraft('a', 'Writer revision prefill');
  const displaced = composerState('a').kept[0]!;
  expect(displaced.label).toBe('Send not confirmed');
  expect(displaced.payload.submission).toEqual(original.payload.submission);
  expect(displaced.payload.files[0]).toBe(original.payload.files[0]);
  swapComposerDraft('a', displaced.id);
  const ordinary = composerState('a').kept.find((draft) => !draft.payload.submission)!;
  swapComposerDraft('a', ordinary.id);
  expect(composerState('a').kept.find((draft) => draft.payload.submission)).toMatchObject({
    label: 'Send not confirmed',
    payload: { submission: original.payload.submission },
  });
});

it('blocks delegation of an uncertain original without losing its identity and permits delegation after editing', async () => {
  initial();
  const lost = vi.fn<Action>(async () => {
    throw new TypeError('Response lost');
  });
  await sendComposerDraft('a', lost);
  const original = composerState('a').kept[0]!;
  swapComposerDraft('a', original.id);
  const draft = composerState('a').draft;
  const action = vi.fn<Action>(async () => ({ id: 'accepted' }));
  expect(await sendComposerDraft('a', action, { roleIds: ['writer'] })).toBe(false);
  expect(action).not.toHaveBeenCalled();
  expect(composerState('a').draft).toBe(draft);
  expect(composerState('a').notice).toContain('unconfirmed send');
  expect(composerState('a').operation).toBeUndefined();
  await sendComposerDraft('a', action);
  expect(action.mock.calls[0]![2]).toMatchObject({
    clientRequestId: original.payload.submission!.id,
  });
  changeComposer('a', 'A new delegation request', []);
  expect(await sendComposerDraft('a', action, { roleIds: ['writer'] })).toBe(true);
  expect(action.mock.calls[1]![0]).toBe('/conversations/a/delegate');
});

it('reconciles a lost response through a read and preserves a newer draft without another POST', async () => {
  initial();
  const post = deferred(),
    action = vi.fn<Action>(() => post.promise);
  const sending = sendComposerDraft('a', action);
  changeComposer('a', 'new text', []);
  vi.mocked(findComposerReceipt).mockResolvedValueOnce(true);
  post.reject(new TypeError('Connection closed after commit'));
  expect(await sending).toBe(true);
  expect(composerState('a')).toMatchObject({
    draft: { text: 'new text' },
    kept: [],
    refreshNeeded: true,
  });
  expect(action).toHaveBeenCalledTimes(1);
  expect(findComposerReceipt).toHaveBeenCalledWith('a', expect.any(String));
});

it('keeps the original send identity and intent for an unchanged retry, and replaces it after edits', async () => {
  initial();
  const action = vi.fn<Action>(async () => {
    throw new TypeError('Offline');
  });
  await sendComposerDraft('a', action, { intent: 'interrupt' });
  const original = action.mock.calls[0]![2] as { clientRequestId: string; intent: string };
  swapComposerDraft('a', composerState('a').kept[0]!.id);
  changeComposer('a', composerState('a').draft.text, [...composerState('a').draft.references]);
  changeComposerFiles('a', [...composerState('a').draft.files]);
  await sendComposerDraft('a', action);
  expect(action.mock.calls[1]![2]).toMatchObject(original);
  swapComposerDraft('a', composerState('a').kept[0]!.id);
  changeComposer('a', 'edited message', []);
  await sendComposerDraft('a', action);
  expect((action.mock.calls[2]![2] as typeof original).clientRequestId).not.toBe(
    original.clientRequestId,
  );
});

it('does not treat a rejected payload as accepted merely because the original send has a receipt', async () => {
  initial();
  vi.mocked(findComposerReceipt).mockResolvedValueOnce(true);
  expect(
    await sendComposerDraft('a', async () => {
      throw new ApiHttpError(409, 'Payload changed');
    }),
  ).toBe(false);
  expect(findComposerReceipt).not.toHaveBeenCalled();
  expect(composerState('a').notice).toBe('Not sent: Payload changed');
  expect(composerState('a').draft.submission).toBeUndefined();
  const retry = vi.fn<Action>(async () => ({ id: 'new-send' }));
  expect(await sendComposerDraft('a', retry)).toBe(true);
  expect(retry.mock.calls[0]![2]).toMatchObject({ clientRequestId: expect.any(String) });
});

it('treats accepted refresh failure as acknowledged, never restoring or resending its payload', async () => {
  initial();
  const request = deferred(),
    action = vi.fn<Action>(() => request.promise),
    sending = sendComposerDraft('a', action);
  changeComposer('a', 'new draft during send', []);
  await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  request.reject(new ActionRefreshError({ id: 'accepted' }, new Error('Read offline')));
  expect(await sending).toBe(true);
  expect(composerState('a')).toMatchObject({
    draft: { text: 'new draft during send' },
    refreshNeeded: true,
    kept: [],
  });
  expect(action).toHaveBeenCalledTimes(1);
});

it('preserves per-thread locks and does not let stale completions consume another operation', () => {
  initial();
  const first = beginComposerSend('a', 'message')!;
  expect(beginComposerSend('a', 'message')).toBeUndefined();
  changeComposer('b', 'independent', []);
  const other = beginComposerSend('b', 'message')!;
  acceptComposerSend('a', other.token);
  expect(composerState('a').operation?.token).toBe(first.token);
  acceptComposerSend('a', first.token);
  expect(composerState('b').operation?.token).toBe(other.token);
});

it('retains handoff collisions exactly once and keeps delegation files in the current draft', async () => {
  const file = initial(),
    values = new Map([['pitchcrew.handoff-draft.a', 'Incoming handoff']]);
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
  });
  consumeComposerHandoff('a');
  consumeComposerHandoff('a');
  expect(composerState('a').draft.text).toBe('Incoming handoff');
  expect(composerState('a').kept).toHaveLength(1);
  expect(composerState('a').kept[0]?.payload.files[0]).toBe(file);
  changeComposerFiles('a', [file]);
  const action = vi.fn(async () => ({ id: 'delegated' }));
  await sendComposerDraft('a', action, { roleIds: ['writer'] });
  expect(composerState('a').draft.files[0]).toBe(file);
  expect(composerState('a').kept).toHaveLength(1);
  vi.unstubAllGlobals();
});

it('restores a local file-reading failure only when the replacement draft was never edited', async () => {
  const file = initial(),
    action = vi.fn<Action>(async () => ({}));
  vi.mocked(encodeAttachment).mockRejectedValueOnce(new Error('Cannot read first.txt'));
  expect(await sendComposerDraft('a', action)).toBe(false);
  expect(action).not.toHaveBeenCalled();
  expect(composerState('a').draft.files[0]).toBe(file);
  expect(composerState('a').draft.references).toEqual([reference]);
  expect(composerState('a').kept).toHaveLength(0);
  expect(composerState('a').draft.submission).toBeUndefined();
  expect(composerState('a').notice).toBe('Not sent: Cannot read first.txt');
  const reading = deferred();
  vi.mocked(encodeAttachment).mockReturnValueOnce(
    reading.promise as ReturnType<typeof encodeAttachment>,
  );
  const sending = sendComposerDraft('a', action);
  changeComposer('a', 'I changed my mind', []);
  changeComposer('a', '', []);
  reading.reject(new Error('Read failed later'));
  await sending;
  expect(action).not.toHaveBeenCalled();
  expect(composerState('a').draft.text).toBe('');
  expect(composerState('a').kept[0]?.payload.files[0]).toBe(file);
  expect(composerState('a').kept[0]?.payload.submission).toBeUndefined();
});

it.each([403, 422])(
  'shows a definitive %s rejection with an unlocked draft and no receipt lookup',
  async (status) => {
    initial();
    const action = vi.fn<Action>(async () => {
      throw new ApiHttpError(status, 'Role is unavailable');
    });
    expect(await sendComposerDraft('a', action)).toBe(false);
    expect(composerState('a')).toMatchObject({
      notice: 'Not sent: Role is unavailable',
      draft: { text: '  @scout hello' },
    });
    expect(composerState('a').draft.submission).toBeUndefined();
    expect(findComposerReceipt).not.toHaveBeenCalled();
  },
);

it('retains an already ambiguous identity if a later unchanged retry fails before POST', async () => {
  initial();
  await sendComposerDraft('a', async () => {
    throw new TypeError('Lost response');
  });
  const identity = composerState('a').kept[0].payload.submission;
  swapComposerDraft('a', composerState('a').kept[0].id);
  vi.mocked(encodeAttachment).mockRejectedValueOnce(new Error('Local read failed'));
  const action = vi.fn<Action>(async () => ({}));
  await sendComposerDraft('a', action);
  expect(action).not.toHaveBeenCalled();
  expect(composerState('a').kept[0]).toMatchObject({
    label: 'Send not confirmed',
    payload: { submission: identity },
  });
  expect(composerState('a').notice).toContain('The original send is still unconfirmed');
});

it.each([403, 422, 409])(
  'preserves an original ambiguous identity after a retry receives %s and resends unchanged with the same UUID',
  async (status) => {
    initial();
    const action = vi
      .fn<Action>()
      .mockRejectedValueOnce(new TypeError('Lost response'))
      .mockRejectedValueOnce(new ApiHttpError(status, 'Retry rejected'))
      .mockResolvedValueOnce({ id: 'accepted' });
    expect(await sendComposerDraft('a', action, { intent: 'interrupt' })).toBe(false);
    const original = composerState('a').kept[0].payload.submission;
    swapComposerDraft('a', composerState('a').kept[0].id);
    expect(await sendComposerDraft('a', action)).toBe(false);
    expect(composerState('a').kept[0]).toMatchObject({
      label: 'Send not confirmed',
      payload: { submission: original },
    });
    expect(composerState('a').notice).toContain('The original send is still unconfirmed');
    expect(composerState('a').notice).not.toContain('Not sent:');
    expect(findComposerReceipt).toHaveBeenCalledTimes(1); // The rejected retry is never promoted.
    swapComposerDraft('a', composerState('a').kept[0].id);
    expect(await sendComposerDraft('a', action)).toBe(true);
    for (const call of action.mock.calls)
      expect(call[2]).toMatchObject({ clientRequestId: original!.id, intent: 'interrupt' });
  },
);

it('refreshes an acknowledged receipt through a read callback only and ignores stale receipt completion', async () => {
  initial();
  const first = beginComposerSend('a', 'message')!;
  acceptComposerSend('a', first.token, true);
  const read = deferred(),
    reload = vi.fn(() => read.promise.then(() => {}));
  const refresh = refreshComposerReceipt('a', first.token, reload);
  changeComposer('a', 'newer send', []);
  const next = beginComposerSend('a', 'message')!;
  acceptComposerSend('a', next.token, true);
  read.resolve({});
  await refresh;
  expect(composerState('a').receipt).toBe(next.token);
  expect(composerState('a').refreshNeeded).toBe(true);
  await refreshComposerReceipt('a', next.token, async () => {});
  expect(composerState('a').refreshNeeded).toBe(false);
  expect(reload).toHaveBeenCalledTimes(1);
});

it('discards only the chosen retained draft and preserves active/other payload identities', async () => {
  initial();
  const action = vi.fn<Action>(async () => {
    throw new Error('Unconfirmed');
  });
  await sendComposerDraft('a', action);
  changeComposer('a', 'second payload', []);
  await sendComposerDraft('a', action);
  const activeFile = new File(['current'], 'current.txt');
  changeComposer('a', '  @scout current', [reference]);
  changeComposerFiles('a', [activeFile]);
  const before = composerState('a'),
    active = before.draft,
    other = before.kept[1]!;
  discardComposerDraft('a', before.kept[0]!.id);
  expect(composerState('a').draft).toBe(active);
  expect(composerState('a').draft.files[0]).toBe(activeFile);
  expect(composerState('a').kept).toEqual([other]);
  expect(composerState('a').kept[0]).toBe(other);
  const operation = beginComposerSend('a', 'message')!;
  discardComposerDraft('a', other.id);
  expect(composerState('a').kept).toEqual([other]);
  acceptComposerSend('a', operation.token);
  const afterAccepted = composerState('a').draft;
  discardComposerDraft('a', other.id);
  expect(composerState('a').draft).toBe(afterAccepted);
  expect(composerState('a').kept).toEqual([]);
  expect(composerState('a').notice).toBe('');
  expect(action).toHaveBeenCalledTimes(2);
});
