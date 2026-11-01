import { Button } from '@/components/ui/button/components/Button.tsx';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import type { ProfileTreeNode } from '../types.ts';
import type { KeyboardEvent } from 'react';
import { ProfileTreeRowMenu, type ProfileTreeRowActions } from './ProfileTreeRowMenu.tsx';

export const ProfileTreeRow = ({
  node,
  depth,
  position,
  size,
  expanded,
  selected,
  dirty,
  focused,
  working,
  activate,
  focus,
  keyDown,
  actions,
}: {
  node: ProfileTreeNode;
  depth: number;
  position: number;
  size: number;
  expanded: boolean;
  selected: boolean;
  dirty: boolean;
  focused: boolean;
  working: boolean;
  activate: () => void;
  focus: () => void;
  keyDown: (event: KeyboardEvent) => void;
  actions: ProfileTreeRowActions;
}) => {
  return (
    <div
      className="profile-tree-row"
      data-selected={selected || undefined}
      style={{ ['--depth' as string]: Math.min(depth - 1, 8) }}
    >
      <Button
        variant="ghost"
        role="treeitem"
        aria-level={depth}
        aria-posinset={position}
        aria-setsize={size}
        aria-expanded={node.folder ? expanded : undefined}
        aria-selected={selected}
        aria-label={dirty ? `${node.label}, unsaved changes` : node.label}
        title={(node.note?.name ?? node.path) || 'profile'}
        data-node-key={node.key}
        tabIndex={focused ? 0 : -1}
        onFocus={focus}
        onKeyDown={keyDown}
        onClick={activate}
        className={`profile-file ${node.folder ? 'profile-folder' : ''}`}
      >
        {node.folder ? (
          expanded ? (
            <ChevronDown size={14} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )
        ) : (
          <FileText size={14} aria-hidden="true" />
        )}
        <span>{node.label}</span>
        {dirty ? <span className="profile-dirty-dot" aria-hidden="true" /> : null}
      </Button>
      <ProfileTreeRowMenu
        node={node}
        tabIndex={focused ? 0 : -1}
        working={working}
        actions={actions}
      />
    </div>
  );
};
