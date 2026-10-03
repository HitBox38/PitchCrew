import type { TooltipContentProps } from '@/components/ui/tooltip/types.ts';
import { cn } from '@/lib/utils';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

export function TooltipContent({
  className,
  side = 'top',
  sideOffset = 0,
  align = 'center',
  alignOffset = 0,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="primitive:isolate primitive:z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            'primitive:z-50 primitive:w-fit primitive:origin-(--transform-origin) primitive:rounded-md primitive:bg-foreground primitive:px-3 primitive:py-1.5 primitive:text-xs primitive:text-balance primitive:text-background',
            className,
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="primitive:z-50 primitive:size-2.5 primitive:translate-y-[calc(-50%-2px)] primitive:rotate-45 primitive:rounded-[2px] primitive:bg-foreground primitive:fill-foreground primitive:data-[side=bottom]:top-1 primitive:data-[side=left]:top-1/2! primitive:data-[side=left]:-right-1 primitive:data-[side=left]:-translate-y-1/2 primitive:data-[side=right]:top-1/2! primitive:data-[side=right]:-left-1 primitive:data-[side=right]:-translate-y-1/2 primitive:data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}
