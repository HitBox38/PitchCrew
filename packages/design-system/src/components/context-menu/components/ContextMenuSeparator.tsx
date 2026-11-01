import { DropdownMenuSeparator } from '../../dropdown-menu/components/DropdownMenuSeparator.tsx';
import type { DropdownMenuSeparatorProps } from '../../dropdown-menu/types.ts';

export const ContextMenuSeparator = (props: DropdownMenuSeparatorProps) => (
  <DropdownMenuSeparator data-slot="context-menu-separator" {...props} />
);
