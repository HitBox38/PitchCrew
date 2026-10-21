import { DropdownMenuSub } from '@/components/ui/dropdown-menu/components/DropdownMenuSub.tsx';
import type { DropdownMenuSubProps } from '@/components/ui/dropdown-menu/types.ts';

export const ContextMenuSub = (props: DropdownMenuSubProps) => (
  <DropdownMenuSub data-slot="context-menu-sub" {...props} />
);
