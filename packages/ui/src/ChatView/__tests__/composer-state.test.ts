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
  swapComposerDraft,
  useComposerStore,
} from '../composer-state.ts';
import { sendComposerDraft } from '../composer-send.ts';
import { encodeAttachment } from '../api.ts';
import { refreshComposerReceipt } from '../composer-recovery.ts';

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
});

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
