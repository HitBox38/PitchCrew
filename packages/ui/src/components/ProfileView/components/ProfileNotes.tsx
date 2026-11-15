import { useRef } from 'react';
import type { ProfileSectionProps } from '../types.ts';
import { documentDirty } from '../documents.ts';
import { useProfileTreeKeyboard } from '../hooks/useProfileTreeKeyboard.ts';
import { useProfileTreeActions } from '../hooks/useProfileTreeActions.ts';
import { ProfileTreeSearch } from './ProfileTreeSearch.tsx';
import { ProfileTreeRow } from './ProfileTreeRow.tsx';
import { ProfileTreeDialogs } from './ProfileTreeDialogs.tsx';
import { ProfileMetadataStatus } from './ProfileMetadataStatus.tsx';

/** The notes explorer: search, the folder tree with its menus, and Undo after a delete. */
export const ProfileNotes = ({ controller: props, tree: c, workspace }: ProfileSectionProps) => {
  const element = useRef<HTMLDivElement>(null);
  const searching = Boolean(c.query.trim());
  const keyboard = useProfileTreeKeyboard(element, c.rows, c.collapsed, c.toggle, searching);
  const { actions, rowActions, rowKeyDown } = useProfileTreeActions(props, c, workspace, keyboard);
  const dirty = new Set(props.documents.filter(documentDirty).map((doc) => doc.saved.name));
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
        count={searching ? c.rows.filter((row) => row.node.note).length : props.data.profile.length}
        working={props.working}
        createNote={() => rowActions.createNote(c.selectedFolder)}
        createFolder={() => rowActions.createFolder(c.selectedFolder)}
        restore={props.restoreNote}
      />
      <div className="profile-notes">
        <ProfileMetadataStatus {...props} />
        <div ref={element} role="tree" aria-label="Profile notes">
          {c.rows.map((row) => (
            <ProfileTreeRow
              key={row.node.key}
              {...row}
              expanded={searching || !c.collapsed.has(row.node.path)}
              selected={row.node.note?.name === props.activeSavedName}
              dirty={!!row.node.note && dirty.has(row.node.note.name)}
              focused={keyboard.focusKey === row.node.key}
              working={props.working}
              blocked={props.blocker}
              focus={() => keyboard.setFocused(row.node.key)}
              keyDown={(event) => rowKeyDown(event, row)}
              activate={() => {
                c.setSelectedFolder(row.node.path);
                if (row.node.folder) c.toggle(row.node.path);
                else if (row.node.note) workspace.openNote(row.node.note, row.snippet?.term ?? '');
              }}
              actions={rowActions}
            />
          ))}
        </div>
        {props.sourceController.loaded && searching && !c.rows.length ? (
          <p className="profile-tree-empty">Nothing matches “{c.query.trim()}”.</p>
        ) : null}
        {props.sourceController.loaded && !searching && !props.data.profile.length ? (
          <div className="profile-tree-start">
            <p>
              No notes yet. Start with your most recent role: what you did and what changed because
              of it.
            </p>
          </div>
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
