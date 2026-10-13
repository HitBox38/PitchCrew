import { Button } from '@/components/ui/button/components/Button.tsx';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, FolderInput } from 'lucide-react';
import type { ProfileTreeNode } from '../types.ts';
import type { KeyboardEvent } from 'react';

export function ProfileTreeRow({
  node,
  depth,
  position,
  size,
  expanded,
  selected,
  focused,
  working,
  activate,
  move,
  focus,
  keyDown,
}: {
  node: ProfileTreeNode;
  depth: number;
  position: number;
  size: number;
  expanded: boolean;
  selected: boolean;
  focused: boolean;
  working: boolean;
  activate: () => void;
  move: () => void;
  focus: () => void;
  keyDown: (event: KeyboardEvent) => void;
}) {
  return (
    <div className="profile-tree-row" style={{ paddingLeft: Math.min(depth - 1, 8) * 12 }}>
      <Button
        variant="ghost"
        role="treeitem"
        aria-level={depth}
        aria-posinset={position}
        aria-setsize={size}
        aria-expanded={node.folder ? expanded : undefined}
        aria-selected={selected}
        aria-label={node.label}
        title={(node.note?.name ?? node.path) || 'profile'}
        data-node-key={node.key}
        tabIndex={focused ? 0 : -1}
        onFocus={focus}
        onKeyDown={keyDown}
        onClick={activate}
        className={`profile-file ${selected ? 'selected' : ''} ${node.folder ? 'profile-folder' : ''}`}
      >
        {node.folder ? (
          <>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {expanded ? <FolderOpen size={15} /> : <Folder size={15} />}
          </>
        ) : (
          <FileText size={15} />
        )}
        <span>{node.label}</span>
      </Button>
      {node.note ? (
        <Button
          variant="ghost"
          className="profile-move-note"
          aria-label={`Move ${node.label} to folder`}
          title="Move to folder"
          tabIndex={focused ? 0 : -1}
          disabled={working}
          onClick={move}
        >
          <FolderInput size={14} />
        </Button>
      ) : null}
    </div>
  );
}
