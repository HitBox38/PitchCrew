import type { useProfileFolderActions } from '../hooks/useProfileFolderActions.ts';
import type { ProfileViewModel } from '../types.ts';
import { ProfileFolderDialog } from './ProfileFolderDialog.tsx';
import { ProfileRenameDialog } from './ProfileRenameDialog.tsx';

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
  if (operation.kind === 'rename') {
    const open = controller.documents.find((doc) => doc.saved.name === operation.note.name);
    return (
      <ProfileRenameDialog
        current={open?.name ?? operation.note.name}
        taken={controller.data.profile
          .map((note) => note.name)
          .filter((name) => name !== operation.note.name)}
        close={actions.close}
        submit={(name) => void actions.submit(name)}
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
