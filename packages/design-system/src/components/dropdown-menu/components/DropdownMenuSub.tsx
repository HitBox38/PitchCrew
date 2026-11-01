import type { DropdownMenuSubProps } from '../types.ts';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

export const DropdownMenuSub = ({ ...props }: DropdownMenuSubProps) => {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
};
