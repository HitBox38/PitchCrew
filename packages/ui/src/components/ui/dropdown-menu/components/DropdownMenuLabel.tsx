import type { DropdownMenuLabelProps } from '@/components/ui/dropdown-menu/types.ts';
import { cn } from '@/lib/utils';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

export function DropdownMenuLabel({ className, inset, ...props }: DropdownMenuLabelProps) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        'primitive:px-2 primitive:py-1.5 primitive:text-sm primitive:font-medium primitive:data-inset:pl-8',
        className,
      )}
      {...props}
    />
  );
}
