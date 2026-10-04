import { SelectScrollDownButton } from '@/components/ui/select/components/SelectScrollDownButton.tsx';
import { SelectScrollUpButton } from '@/components/ui/select/components/SelectScrollUpButton.tsx';
import type { SelectContentProps } from '@/components/ui/select/types.ts';
import { cn } from '@/lib/utils';
import { Select as SelectPrimitive } from '@base-ui/react/select';

export function SelectContent({
  className,
  children,
  side = 'bottom',
  sideOffset = 4,
  align = 'start',
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="primitive:isolate primitive:z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            'primitive:relative primitive:z-50 primitive:max-h-(--available-height) primitive:min-w-[max(8rem,var(--anchor-width))] primitive:origin-(--transform-origin) primitive:overflow-x-hidden primitive:overflow-y-auto primitive:rounded-md primitive:border primitive:bg-popover primitive:text-popover-foreground primitive:shadow-md primitive:data-[align-trigger=true]:animate-none',
            !alignItemWithTrigger &&
              'primitive:data-[side=bottom]:translate-y-1 primitive:data-[side=left]:-translate-x-1 primitive:data-[side=right]:translate-x-1 primitive:data-[side=top]:-translate-y-1',
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List
            data-slot="select-list"
            className="primitive:scroll-my-1 primitive:p-1"
          >
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}
