import type { DropdownMenuProps } from '../types.ts';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

export const DropdownMenu = ({ ...props }: DropdownMenuProps) => {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
};
