import { DropdownMenuContent } from '@/components/ui/dropdown-menu/components/DropdownMenuContent.tsx';
import type { DropdownMenuSubContentProps } from '@/components/ui/dropdown-menu/types.ts';
import { cn } from '@/lib/utils';

export function DropdownMenuSubContent({
  align = 'start',
  alignOffset = -3,
  side = 'right',
  sideOffset = 0,
  className,
  ...props
}: DropdownMenuSubContentProps) {
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
}
