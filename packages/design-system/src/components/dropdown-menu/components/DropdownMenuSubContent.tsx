import { DropdownMenuContent } from './DropdownMenuContent.tsx';
import type { DropdownMenuSubContentProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const DropdownMenuSubContent = ({
  align = 'start',
  alignOffset = -3,
  side = 'right',
  sideOffset = 0,
  className,
  ...props
}: DropdownMenuSubContentProps) => {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn('primitive:shadow-lg', className)}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
};
