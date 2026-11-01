import type { DropdownMenuGroupProps } from '../types.ts';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

export const DropdownMenuGroup = ({ ...props }: DropdownMenuGroupProps) => {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
};
