import type { DropdownMenuContentProps } from '@/components/ui/dropdown-menu/types.ts';
import { cn } from '@/lib/utils';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

export function DropdownMenuContent({
  align = 'start',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 4,
  className,
  ...props
}: DropdownMenuContentProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="primitive:isolate primitive:z-50 primitive:outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            'primitive:z-50 primitive:max-h-(--available-height) primitive:min-w-[8rem] primitive:origin-(--transform-origin) primitive:overflow-x-hidden primitive:overflow-y-auto primitive:rounded-md primitive:border primitive:bg-popover primitive:p-1 primitive:text-popover-foreground primitive:shadow-md primitive:outline-none',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}
