import type { DropdownMenuPortalProps } from '@/components/ui/dropdown-menu/types.ts';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

export function DropdownMenuPortal({ ...props }: DropdownMenuPortalProps) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}
