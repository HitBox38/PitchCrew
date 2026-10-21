import type { ContextMenuContentProps } from '../types.ts';
import { cn } from '@/lib/utils';
import { ContextMenu as MenuPrimitive } from '@base-ui/react/context-menu';

export const ContextMenuContent = ({
  align = 'start',
  alignOffset = 4,
  side = 'right',
  sideOffset = 0,
  className,
  ...props
}: ContextMenuContentProps) => {
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
          data-slot="context-menu-content"
          className={cn(
            'primitive:z-50 primitive:max-h-(--available-height) primitive:min-w-[8rem] primitive:origin-(--transform-origin) primitive:overflow-x-hidden primitive:overflow-y-auto primitive:rounded-md primitive:border primitive:border-border primitive:bg-popover primitive:p-1 primitive:text-popover-foreground primitive:shadow-md primitive:outline-none',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
};
