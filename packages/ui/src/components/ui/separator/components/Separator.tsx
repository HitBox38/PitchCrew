import type { SeparatorProps } from '@/components/ui/separator/types.ts';
import { cn } from '@/lib/utils';
import { Separator as SeparatorPrimitive } from '@base-ui/react/separator';

export function Separator({ className, orientation = 'horizontal', ...props }: SeparatorProps) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        'primitive:shrink-0 primitive:bg-border primitive:data-horizontal:h-px primitive:data-horizontal:w-full primitive:data-vertical:h-full primitive:data-vertical:w-px',
        className,
      )}
      {...props}
    />
  );
}
