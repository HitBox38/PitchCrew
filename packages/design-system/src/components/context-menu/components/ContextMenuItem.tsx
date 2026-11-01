import { DropdownMenuItem } from '../../dropdown-menu/components/DropdownMenuItem.tsx';
import type { DropdownMenuItemProps } from '../../dropdown-menu/types.ts';

export const ContextMenuItem = (props: DropdownMenuItemProps) => (
  <DropdownMenuItem data-slot="context-menu-item" {...props} />
);
