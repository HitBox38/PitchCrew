import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

/** Copies text and confirms with a toast; shows the text instead when the clipboard is blocked. */
export function copyText(text: string, copied: string) {
  void navigator.clipboard.writeText(text).then(
    () => useWorkspaceStore.getState().setToast(copied),
    () => useWorkspaceStore.getState().setToast(text),
  );
}
