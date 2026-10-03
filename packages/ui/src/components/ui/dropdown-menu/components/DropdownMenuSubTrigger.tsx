import type { DropdownMenuSubTriggerProps } from '@/components/ui/dropdown-menu/types.ts';
import { cn } from '@/lib/utils';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { ChevronRightIcon } from 'lucide-react';

export function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: DropdownMenuSubTriggerProps) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "primitive:flex primitive:cursor-default primitive:items-center primitive:gap-2 primitive:rounded-sm primitive:px-2 primitive:py-1.5 primitive:text-sm primitive:outline-hidden primitive:select-none primitive:focus:bg-accent primitive:focus:text-accent-foreground primitive:data-inset:pl-8 primitive:data-popup-open:bg-accent primitive:data-popup-open:text-accent-foreground primitive:[&_svg]:pointer-events-none primitive:[&_svg]:shrink-0 primitive:[&_svg:not([class*='size-'])]:size-4 primitive:[&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="primitive:ml-auto primitive:size-4" />
    </MenuPrimitive.SubmenuTrigger>
  );
}
