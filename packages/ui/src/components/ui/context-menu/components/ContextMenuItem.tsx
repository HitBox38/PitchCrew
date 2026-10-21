import { DropdownMenuItem } from '@/components/ui/dropdown-menu/components/DropdownMenuItem.tsx';
import type { DropdownMenuItemProps } from '@/components/ui/dropdown-menu/types.ts';

export const ContextMenuItem = (props: DropdownMenuItemProps) => (
  <DropdownMenuItem data-slot="context-menu-item" {...props} />
);
