import { validateAttachments } from '../attachment-helpers.ts';
import type { ChatThread } from '../types.ts';
import {
  changeComposerFiles,
  composerState,
  emptyComposer,
  useComposerStore,
} from '../composer-state.ts';

export const useChatAttachments = (thread: ChatThread, setError: (message: string) => void) => {
  const files = useComposerStore((state) => (state.threads[thread] ?? emptyComposer).draft.files);
  const addFiles = (selected: File[]) => {
    const current = composerState(thread).draft.files;
    const error = validateAttachments([...current, ...selected]);
    if (error) {
      setError(error);
      return;
    }
    setError('');
    changeComposerFiles(thread, [...current, ...selected]);
  };
  const removeFile = (index: number) => {
    setError('');
    changeComposerFiles(
      thread,
      composerState(thread).draft.files.filter((_, position) => position !== index),
    );
  };
  return { files, addFiles, removeFile };
};
