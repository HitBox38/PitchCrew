import { Popover } from '@base-ui/react/popover';
import { cn } from '@/lib/utils';

type PopoverContentProps = Popover.Popup.Props &
  Pick<Popover.Positioner.Props, 'side' | 'align' | 'sideOffset' | 'alignOffset'>;

/** Opaque floating pane: 10px corners and the shared pop shadow; placement is the caller's. */
export const PopoverContent = ({
  className,
  children,
  side,
  align = 'start',
  sideOffset = 6,
  alignOffset,
  ...props
}: PopoverContentProps) => {
  return (
    <Popover.Portal>
      <Popover.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={8}
        className="z-50"
      >
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
};
