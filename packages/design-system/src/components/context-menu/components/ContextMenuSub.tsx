import { DropdownMenuSub } from '../../dropdown-menu/components/DropdownMenuSub.tsx';
import type { DropdownMenuSubProps } from '../../dropdown-menu/types.ts';

export const ContextMenuSub = (props: DropdownMenuSubProps) => (
  <DropdownMenuSub data-slot="context-menu-sub" {...props} />
);
