import { DropdownMenuGroup } from '../../dropdown-menu/components/DropdownMenuGroup.tsx';
import type { DropdownMenuGroupProps } from '../../dropdown-menu/types.ts';

export const ContextMenuGroup = (props: DropdownMenuGroupProps) => (
  <DropdownMenuGroup data-slot="context-menu-group" {...props} />
);
