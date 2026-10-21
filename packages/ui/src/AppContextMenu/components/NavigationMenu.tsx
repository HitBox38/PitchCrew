import { viewIcons, viewTitles, workspaceViews } from '@/AppSidebar/constants.ts';
import {
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu/index.tsx';
import { Compass } from 'lucide-react';
import type { View } from '@/navigation.ts';

export const NavigationMenu = ({
  view,
  navigate,
}: {
  view: View | undefined;
  navigate: (view: View) => void;
}) => (
  <ContextMenuSub>
    <ContextMenuSubTrigger>
      <Compass />
      Go to…
    </ContextMenuSubTrigger>
    <ContextMenuSubContent aria-label="Workspace pages">
      <ContextMenuGroup>
        {(['board', ...workspaceViews, 'settings'] as const).map((item) => {
          const Icon = viewIcons[item];
          return (
            <ContextMenuItem key={item} disabled={item === view} onClick={() => navigate(item)}>
              <Icon />
              {viewTitles[item]}
            </ContextMenuItem>
          );
        })}
      </ContextMenuGroup>
    </ContextMenuSubContent>
  </ContextMenuSub>
);
