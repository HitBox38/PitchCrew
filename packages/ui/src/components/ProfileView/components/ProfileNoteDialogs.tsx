import type { ProfileSectionProps } from '../types.ts';
import { documentDirty } from '../documents.ts';
import { filenameProblem, noteCitations, noteLabel, slugName } from '../helpers.ts';
import { ProfileCreateDialog } from './ProfileCreateDialog.tsx';
import { ProfileDeleteDialog } from './ProfileDeleteDialog.tsx';
import { ProfileRenameDialog } from './ProfileRenameDialog.tsx';

const renameDescription = (cited: number) =>
  `The note keeps its folder, text and source link.${
    cited
      ? ` ${cited} ${cited === 1 ? 'packet quotes' : 'packets quote'} it by filename and will need a new draft before export.`
      : ''
  }`;

/** New, rename and delete for one note, opened from the title row, tree, tabs or palette. */
export const ProfileNoteDialogs = ({ controller: c, tree, workspace: w }: ProfileSectionProps) => {
  const dialog = w.dialog;
  const close = () => w.setDialog(null);
  if (!dialog) return null;
  if (dialog.kind === 'create')
    return (
      <ProfileCreateDialog
        folder={dialog.folder}
        folders={tree.folders}
        taken={c.taken()}
        close={close}
        create={async (title, folder) => {
          const opened = await w.finishCreate(title, folder);
          if (opened) tree.reveal(folder);
          return opened;
        }}
      />
    );
  if (dialog.kind === 'rename')
    return (
      <ProfileRenameDialog
        title="Rename note"
        description={renameDescription(noteCitations(c.data.cards, dialog.name).length)}
        label="Name"
        current={noteLabel(dialog.name)}
        problem={(name) =>
          slugName(name)
            ? filenameProblem(
                `${slugName(name)}.md`,
                c.taken().filter((other) => other.toLowerCase() !== dialog.name.toLowerCase()),
              )
            : 'Give the note a name with letters or numbers.'
        }
        close={close}
        submit={async (name) => {
          const next = `${slugName(name)}.md`;
          if (next !== dialog.name) await c.renameNote(dialog.name, next);
          close();
        }}
        hint={(name) => (slugName(name) ? `${slugName(name)}.md` : '')}
      />
    );
  const open = c.documents.find((document) => document.saved.name === dialog.name);
  const source = c.sourceController.sources.find((entry) =>
    entry.files.some((file) => file.name === dialog.name),
  );
  return (
    <ProfileDeleteDialog
      name={dialog.name}
      cited={noteCitations(c.data.cards, dialog.name).length}
      source={source?.label ?? ''}
      unsaved={!!open && documentDirty(open) && open.persisted}
      close={close}
      remove={() => c.deleteNote(dialog.name)}
    />
  );
};
