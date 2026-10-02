import type { DropdownMenuProps } from '@/components/ui/dropdown-menu/types.ts';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

export function DropdownMenu({ ...props }: DropdownMenuProps) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}
