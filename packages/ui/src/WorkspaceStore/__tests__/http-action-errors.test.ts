import { afterEach, expect, it, vi } from 'vitest';
import { api } from '@/api.ts';
import { ApiHttpError } from '@/api-errors.ts';
import { createWorkspaceStore } from '../index.ts';
import { ActionRefreshError } from '../action-errors.ts';

vi.mock('@/api.ts', () => ({ api: vi.fn() }));
vi.mock('@/chat-stream.ts', () => ({ subscribeChatStream: vi.fn() }));

afterEach(() => vi.mocked(api).mockReset());

it('preserves the original HTTP mutation failure without refreshing or adding a suppressed toast', async () => {
  const store = createWorkspaceStore();
  store.getState().setToast('Unrelated notice', 'info');
  const rejected = new ApiHttpError(
    400,
    'The application brief changed. Answer its current requirements instead.',
  );
  vi.mocked(api).mockRejectedValueOnce(rejected);
  await expect(
    store
      .getState()
      .action('/user-input/question/answer', 'POST', {}, undefined, { errorToast: false }),
  ).rejects.toBe(rejected);
  expect(api).toHaveBeenCalledExactlyOnceWith('/user-input/question/answer', 'POST', {});
  expect(store.getState().working).toBe(false);
  expect(store.getState().toast).toBe('Unrelated notice');
});

it('wraps a refresh HTTP failure only after the mutation returned an accepted payload', async () => {
  const store = createWorkspaceStore();
  store.getState().setToast('Unrelated notice', 'info');
  const result = { id: 'accepted-continuation', userInputId: 'question' };
  const refreshFailure = new ApiHttpError(403, 'The workspace session expired.');
  vi.mocked(api).mockResolvedValueOnce(result).mockRejectedValueOnce(refreshFailure);
  const error = await store
    .getState()
    .action('/user-input/question/answer', 'POST', {}, undefined, { errorToast: false })
    .catch((error: unknown) => error);
  expect(error).toBeInstanceOf(ActionRefreshError);
  expect(error).not.toBeInstanceOf(ApiHttpError);
  expect(error).toMatchObject({ mutationAccepted: true, result, cause: refreshFailure });
  expect(vi.mocked(api).mock.calls.map(([path]) => path)).toEqual([
    '/user-input/question/answer',
    '/snapshot?view=workspace',
  ]);
  expect(store.getState().working).toBe(false);
  expect(store.getState().toast).toBe('Unrelated notice');
  expect(store.getState().error).toBe('The workspace session expired.');
});
