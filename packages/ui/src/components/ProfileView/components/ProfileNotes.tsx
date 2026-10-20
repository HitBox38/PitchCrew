import { useRef } from 'react';
import type { ProfileNotesProps } from '../types.ts';
import { useProfileNotes } from '../hooks/useProfileNotes.ts';
import { useProfileTreeKeyboard } from '../hooks/useProfileTreeKeyboard.ts';
import { useProfileFolderActions } from '../hooks/useProfileFolderActions.ts';
import { ProfileExplorerControls } from './ProfileExplorerControls.tsx';
import { ProfileTreeRow } from './ProfileTreeRow.tsx';
import { ProfileFolderDialog } from './ProfileFolderDialog.tsx';

export const ProfileNotes = (props: ProfileNotesProps) => {
  const c = useProfileNotes(props);
  const tree = useRef<HTMLDivElement>(null);
  const keyboard = useProfileTreeKeyboard(
    tree,
    c.rows,
    c.collapsed,
    c.toggle,
    Boolean(c.query.trim()),
  );
  const actions = useProfileFolderActions(props, c);
  return (
    <aside
      id="profile-explorer"
      className="profile-aside"
      aria-label="Notes explorer"
      hidden={props.hidden}
    >
      <ProfileExplorerControls
        query={c.query}
        setQuery={c.setQuery}
        folder={c.selectedFolder}
        working={props.working}
        createNote={() => {
          void props.createNote(c.selectedFolder).then((opened) => {
            if (opened) c.reveal(c.selectedFolder);
          });
        }}
        createFolder={() => actions.start({ kind: 'create', parent: c.selectedFolder })}
      />
      <div className="profile-notes">
        <div ref={tree} role="tree" aria-label="Profile notes">
          {c.rows.map((row) => (
            <ProfileTreeRow
              key={row.node.key}
              node={row.node}
              depth={row.depth}
              position={row.position}
              size={row.size}
              expanded={Boolean(c.query.trim()) || !c.collapsed.has(row.node.path)}
              selected={row.node.note?.name === props.name}
              focused={keyboard.focusKey === row.node.key}
              working={props.working}
              focus={() => keyboard.setFocused(row.node.key)}
              keyDown={(event) => keyboard.keyDown(event, row)}
              activate={() => {
                c.setSelectedFolder(row.node.path);
                if (row.node.folder) c.toggle(row.node.path);
                else if (row.node.note) props.openNote(row.node.note);
              }}
              move={() =>
                actions.start({ kind: 'move', name: row.node.note!.name, current: row.node.path })
              }
            />
          ))}
        </div>
        {!c.rows.length ? <p className="quiet px-3 py-2">No notes match your search.</p> : null}
        {props.organization.error && !actions.operation ? (
          <p className="form-error px-3 py-2" role="alert">
            {props.organization.error}
          </p>
        ) : null}
      </div>
      {actions.operation ? (
        <ProfileFolderDialog
          operation={actions.operation}
          folders={c.folders}
          working={props.working}
          error={props.organization.error}
          close={actions.close}
          submit={actions.submit}
        />
      ) : null}
    </aside>
  );
};
