import { DropdownMenuGroup } from '@/components/ui/dropdown-menu/components/DropdownMenuGroup.tsx';
import type { DropdownMenuGroupProps } from '@/components/ui/dropdown-menu/types.ts';

export const ContextMenuGroup = (props: DropdownMenuGroupProps) => (
  <DropdownMenuGroup data-slot="context-menu-group" {...props} />
);
