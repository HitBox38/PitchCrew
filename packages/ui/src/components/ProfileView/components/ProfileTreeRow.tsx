import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@pitchcrew/design-system/context-menu';
import { ProfileTreeRowMenu, type ProfileTreeRowActions } from './ProfileTreeRowMenu.tsx';
import { ProfileTreeMenuItems } from './ProfileTreeMenuItems.tsx';
import { ProfileTreeItem, treeItemId, type ProfileTreeItemProps } from './ProfileTreeItem.tsx';
import { Highlight } from './Highlight.tsx';

/** One explorer row: the tree item, its ⋯ and right-click menus, and any passage or hint. */
export const ProfileTreeRow = ({
  snippet,
  working,
  blocked,
  actions,
  ...item
}: ProfileTreeItemProps & {
  snippet?: { text: string; count: number; term: string };
  working: boolean;
  blocked?: string;
  actions: ProfileTreeRowActions;
  parent?: string | null;
}) => {
  const { node } = item;
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            className="profile-tree-row"
            data-selected={item.selected || undefined}
            data-folder={node.folder || undefined}
            style={{ ['--depth' as string]: Math.min(item.depth - 1, 8) }}
          />
        }
      >
        <ProfileTreeItem {...item} />
        <ProfileTreeRowMenu
          node={node}
          tabIndex={item.focused ? 0 : -1}
          working={working}
          blocked={blocked}
          actions={actions}
        />
        {snippet ? (
          <label className="profile-tree-snippet" htmlFor={treeItemId(node.key)} aria-hidden="true">
            <span className="profile-tree-snippet-text">
              <Highlight text={snippet.text} query={snippet.term} />
            </span>
            {snippet.count > 1 ? (
              <span className="profile-tree-matches">{snippet.count}</span>
            ) : null}
          </label>
        ) : null}
        {node.folder && !node.children.length && item.expanded ? (
          <p className="profile-tree-empty-folder" aria-hidden="true">
            Empty
          </p>
        ) : null}
      </ContextMenuTrigger>
      <ContextMenuContent aria-label={`Actions for ${node.label}`} className="w-60">
        <ProfileTreeMenuItems
          node={node}
          working={working}
          blocked={blocked}
          actions={actions}
          context
        />
      </ContextMenuContent>
    </ContextMenu>
  );
};
