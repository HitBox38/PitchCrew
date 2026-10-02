import type { DropdownMenuGroupProps } from '@/components/ui/dropdown-menu/types.ts';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

export function DropdownMenuGroup({ ...props }: DropdownMenuGroupProps) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}
