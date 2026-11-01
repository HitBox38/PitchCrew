import type { DropdownMenuSeparatorProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

export const DropdownMenuSeparator = ({ className, ...props }: DropdownMenuSeparatorProps) => {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('primitive:-mx-1 primitive:my-1 primitive:h-px primitive:bg-border', className)}
      {...props}
    />
  );
};
