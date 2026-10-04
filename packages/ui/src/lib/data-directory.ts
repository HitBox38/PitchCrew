import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export function copyDataDirectory(directory: string) {
  void navigator.clipboard.writeText(directory).then(
    () => useWorkspaceStore.getState().setToast('Copied the data folder path'),
    () => useWorkspaceStore.getState().setToast(`Data folder: ${directory}`),
  );
}
