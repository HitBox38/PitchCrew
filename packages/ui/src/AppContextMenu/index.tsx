import { Copy, Link, MessageSquarePlus, Plus, RefreshCw, Search } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu/index.tsx';
import { copyText } from '@/lib/clipboard.ts';
import { useAppContextMenu } from './hooks/useAppContextMenu.ts';
import { NavigationMenu } from './components/NavigationMenu.tsx';
import type { AppContextMenuProps } from './types.ts';

export const AppContextMenu = (props: AppContextMenuProps) => {
  const model = useAppContextMenu(props);
  return (
    <ContextMenu open={model.open} onOpenChange={model.openChange}>
      <ContextMenuTrigger
        className="contents"
        onContextMenuCapture={model.captureSelection}
        onContextMenu={model.prepare}
        onTouchStart={model.prepare}
      >
        {props.children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className="min-w-56"
        aria-label={model.selectionOnly ? 'Text actions' : 'Workspace actions'}
        anchor={model.anchor}
        finalFocus={model.finalFocus}
      >
        <ContextMenuGroup>
          <ContextMenuItem
            disabled={!model.selection}
            onClick={() => copyText(model.selection, 'Text copied')}
          >
            <Copy />
            Copy selected text
          </ContextMenuItem>
          {!model.selectionOnly ? (
            <ContextMenuItem
              disabled={!model.link}
              onClick={() => copyText(model.link, 'Link copied')}
            >
              <Link />
              Copy link
            </ContextMenuItem>
          ) : null}
        </ContextMenuGroup>
        {!model.selectionOnly ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuItem onClick={model.search}>
                <Search />
                Search workspace…
              </ContextMenuItem>
              <ContextMenuItem disabled={props.working} onClick={model.addJob}>
                <Plus />
                Add job…
              </ContextMenuItem>
              <ContextMenuItem disabled={props.working} onClick={model.newConversation}>
                <MessageSquarePlus />
                New conversation…
              </ContextMenuItem>
              <NavigationMenu view={props.view} navigate={model.navigate} />
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuItem disabled={props.working} onClick={model.refresh}>
              <RefreshCw />
              Refresh workspace
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
};
