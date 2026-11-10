import type { useProfileFolderActions } from '../hooks/useProfileFolderActions.ts';
import type { ProfileViewModel } from '../types.ts';
import { ProfileFolderDialog } from './ProfileFolderDialog.tsx';
import { ProfileRenameDialog } from './ProfileRenameDialog.tsx';

/** Folder dialogs: new folder, move a note, rename a folder. */
export const ProfileTreeDialogs = ({
  actions,
  folders,
  controller,
}: {
  actions: ReturnType<typeof useProfileFolderActions>;
  folders: string[];
  controller: ProfileViewModel;
}) => {
  const operation = actions.operation;
  if (!operation) return null;
  if (operation.kind === 'rename-folder') {
    const parent = operation.path.split('/').slice(0, -1).join('/');
    const label = operation.path.split('/').at(-1)!;
    return (
      <ProfileRenameDialog
        title="Rename folder"
        description="Notes inside keep their filenames; only the folder’s name changes."
        label="Folder name"
        current={label}
        problem={(name) => {
          if (/[\\/]/.test(name) || name === '.' || name === '..')
            return 'Use a folder name without slashes or backslashes.';
          const path = [parent, name].filter(Boolean).join('/');
          return folders.includes(path) ? 'A folder with this name already exists here.' : '';
        }}
        close={actions.close}
        submit={(name) => actions.submit([parent, name].filter(Boolean).join('/'))}
      />
    );
  }
  return (
    <ProfileFolderDialog
      operation={operation}
      folders={folders}
      working={controller.working}
      error={controller.organization.error}
      close={actions.close}
      submit={actions.submit}
    />
  );
};
