import type { DropdownMenuTriggerProps } from '../types.ts';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

export const DropdownMenuTrigger = ({ ...props }: DropdownMenuTriggerProps) => {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
};
