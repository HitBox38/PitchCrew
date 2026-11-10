import type { KeyboardEvent } from 'react';
import { ChevronRight, FileText } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { ProfileTreeNode } from '../types.ts';

export interface ProfileTreeItemProps {
  node: ProfileTreeNode;
  depth: number;
  position: number;
  size: number;
  expanded: boolean;
  selected: boolean;
  dirty: boolean;
  focused: boolean;
  activate: () => void;
  focus: () => void;
  keyDown: (event: KeyboardEvent) => void;
}

/** The id of a row's tree item, so its search passage can label it (and open it on a click). */
export const treeItemId = (key: string) => `profile-tree-${key.replace(/[^\w-]/g, '_')}`;

/** The row's tree item: a rotating chevron for folders or a file icon, the name, a dirty dot. */
export const ProfileTreeItem = (props: ProfileTreeItemProps) => {
  const { node, expanded, dirty } = props;
  const empty = node.folder && !node.children.length;
  return (
    <Button
      variant="ghost"
      role="treeitem"
      aria-level={props.depth}
      aria-posinset={props.position}
      aria-setsize={props.size}
      aria-expanded={node.folder ? expanded : undefined}
      aria-selected={props.selected}
      aria-label={`${node.label}${dirty ? ', unsaved changes' : ''}${empty ? ', empty folder' : ''}`}
      title={(node.note?.name ?? node.path) || 'profile'}
      id={treeItemId(node.key)}
      data-node-key={node.key}
      tabIndex={props.focused ? 0 : -1}
      onFocus={props.focus}
      onKeyDown={props.keyDown}
      onClick={props.activate}
      className={`profile-file ${node.folder ? 'profile-folder' : ''}`}
    >
      {node.folder ? (
        <ChevronRight
          size={14}
          aria-hidden="true"
          className="profile-chevron"
          data-open={expanded || undefined}
        />
      ) : (
        <FileText size={14} aria-hidden="true" />
      )}
      <span className="profile-file-label">{node.label}</span>
      {dirty ? <span className="profile-dirty-dot" aria-hidden="true" /> : null}
    </Button>
  );
};
