import type { ReactElement } from 'react';
import { CheckCheck, Copy, CopyX, FilePen, FolderSearch, Trash2, X } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@pitchcrew/design-system/context-menu';
import { DropdownMenuShortcut } from '@pitchcrew/design-system/dropdown-menu';
import { copyText } from '@/lib/clipboard.ts';
import type { ProfileDocument, ProfileSectionProps } from '../types.ts';

/** Right-click on a tab: closing in bulk, and the note actions the explorer offers. */
export const ProfileTabMenu = ({
  document,
  children,
  section: { controller: c, tree, workspace },
}: {
  document: ProfileDocument;
  children: ReactElement;
  section: ProfileSectionProps;
}) => {
  const name = document.saved.name;
  const others = c.documents.filter((entry) => entry.id !== document.id).map((entry) => entry.id);
  return (
    <ContextMenu>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent aria-label={`Actions for ${document.name}`} className="w-60">
        <ContextMenuGroup>
          <ContextMenuItem onClick={() => c.closeNote(document.id)}>
            <X /> Close
          </ContextMenuItem>
          <ContextMenuItem disabled={!others.length} onClick={() => c.closeMany(others)}>
            <CopyX /> Close others
          </ContextMenuItem>
          <ContextMenuItem onClick={() => c.closeMany(c.documents.map((entry) => entry.id))}>
            <CheckCheck /> Close saved notes
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem
            disabled={c.working || !!c.blocker}
            title={c.blocker || undefined}
            onClick={() => workspace.setDialog({ kind: 'rename', name })}
          >
            <FilePen /> Rename…
            <DropdownMenuShortcut className="md-key-hint">F2</DropdownMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              if (!workspace.explorerVisible) workspace.toggleExplorer();
              tree.reveal(tree.folderOf(name));
            }}
          >
            <FolderSearch /> Reveal in explorer
          </ContextMenuItem>
          <ContextMenuItem onClick={() => copyText(name, 'Copied the filename')}>
            <Copy /> Copy filename
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem
            variant="destructive"
            disabled={c.working || !!c.blocker}
            title={c.blocker || undefined}
            onClick={() => workspace.setDialog({ kind: 'delete', name })}
          >
            <Trash2 /> Delete…
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
};
