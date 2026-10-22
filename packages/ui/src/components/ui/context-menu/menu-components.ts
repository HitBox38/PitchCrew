import {
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu/index.tsx';
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu/index.tsx';

export const menuComponents = (context: boolean) =>
  context
    ? {
        Group: ContextMenuGroup,
        Item: ContextMenuItem,
        Label: ContextMenuLabel,
        Separator: ContextMenuSeparator,
        Sub: ContextMenuSub,
        SubContent: ContextMenuSubContent,
        SubTrigger: ContextMenuSubTrigger,
      }
    : {
        Group: DropdownMenuGroup,
        Item: DropdownMenuItem,
        Label: DropdownMenuLabel,
        Separator: DropdownMenuSeparator,
        Sub: DropdownMenuSub,
        SubContent: DropdownMenuSubContent,
        SubTrigger: DropdownMenuSubTrigger,
      };
