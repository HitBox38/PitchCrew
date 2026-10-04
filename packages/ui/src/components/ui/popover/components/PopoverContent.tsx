import { Popover } from '@base-ui/react/popover';
import { cn } from '@/lib/utils';

export function PopoverContent({ className, children, ...props }: Popover.Popup.Props) {
  return (
    <Popover.Portal>
      <Popover.Positioner sideOffset={6} align="start" className="z-50">
        <Popover.Popup
          data-slot="popover-content"
          className={cn('ui-popover', className)}
          {...props}
        >
          {children}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  );
}
