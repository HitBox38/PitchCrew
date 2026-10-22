import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu/components/DropdownMenuSeparator.tsx';
import type { DropdownMenuSeparatorProps } from '@/components/ui/dropdown-menu/types.ts';

export const ContextMenuSeparator = (props: DropdownMenuSeparatorProps) => (
  <DropdownMenuSeparator data-slot="context-menu-separator" {...props} />
);
