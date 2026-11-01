import { useRef } from 'react';
import type { ProfileSectionProps, ProfileTreeNode } from '../types.ts';
import { documentDirty } from '../helpers.ts';
import { useProfileTreeKeyboard } from '../hooks/useProfileTreeKeyboard.ts';
import { useProfileFolderActions } from '../hooks/useProfileFolderActions.ts';
import { ProfileTreeSearch } from './ProfileTreeSearch.tsx';
import { ProfileTreeRow } from './ProfileTreeRow.tsx';
import { ProfileTreeDialogs } from './ProfileTreeDialogs.tsx';

export const ProfileNotes = ({ controller: props, tree: c, workspace }: ProfileSectionProps) => {
  const element = useRef<HTMLDivElement>(null);
  const searching = Boolean(c.query.trim());
  const keyboard = useProfileTreeKeyboard(element, c.rows, c.collapsed, c.toggle, searching);
  const actions = useProfileFolderActions(props, c);
  const dirty = new Set(props.documents.filter(documentDirty).map((doc) => doc.saved.name));
  const createNote = (folder: string) => {
    void workspace.createNote(folder).then((opened) => {
      if (opened) c.reveal(folder);
    });
  };
  const rowActions = {
    createNote,
    createFolder: (parent: string) => actions.start({ kind: 'create', parent }),
    move: (node: ProfileTreeNode) =>
      actions.start({ kind: 'move', name: node.note!.name, current: node.path }),
    rename: (node: ProfileTreeNode) => {
      const open = props.documents.find((doc) => doc.saved.name === node.note!.name);
      actions.start({
        kind: 'rename',
        note: { name: node.note!.name, content: open?.content ?? node.note!.content },
      });
    },
  };
  const separator = props.data.dataDirectory.includes('\\') ? '\\' : '/';
  return (
    <aside
      id="profile-explorer"
      className="profile-aside"
      aria-label="Notes explorer"
      hidden={!workspace.explorerVisible}
    >
      <ProfileTreeSearch
        query={c.query}
        setQuery={c.setQuery}
        folder={c.selectedFolder}
        directory={`${props.data.dataDirectory}${separator}profile`}
        working={props.working}
        createNote={() => createNote(c.selectedFolder)}
        createFolder={() => rowActions.createFolder(c.selectedFolder)}
      />
      <div className="profile-notes">
        <div ref={element} role="tree" aria-label="Profile notes">
          {c.rows.map((row) => (
            <ProfileTreeRow
              key={row.node.key}
              node={row.node}
              depth={row.depth}
              position={row.position}
              size={row.size}
              expanded={searching || !c.collapsed.has(row.node.path)}
              selected={row.node.note?.name === props.activeSavedName}
              dirty={!!row.node.note && dirty.has(row.node.note.name)}
              focused={keyboard.focusKey === row.node.key}
              working={props.working}
              focus={() => keyboard.setFocused(row.node.key)}
              keyDown={(event) => keyboard.keyDown(event, row)}
              activate={() => {
                c.setSelectedFolder(row.node.path);
                if (row.node.folder) c.toggle(row.node.path);
                else if (row.node.note) workspace.openNote(row.node.note);
              }}
              actions={rowActions}
            />
          ))}
        </div>
        {!c.rows.length ? (
          <p className="profile-tree-empty">
            {searching ? 'No notes match your search.' : 'No notes yet.'}
          </p>
        ) : null}
        {props.organization.error && !actions.operation ? (
          <p className="form-error px-2 py-2" role="alert">
            {props.organization.error}
          </p>
        ) : null}
      </div>
      <ProfileTreeDialogs actions={actions} folders={c.folders} controller={props} />
    </aside>
  );
};
