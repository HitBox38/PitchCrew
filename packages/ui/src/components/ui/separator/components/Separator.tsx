import type { SeparatorProps } from '@/components/ui/separator/types.ts';
import { cn } from '@/lib/utils';
import { Separator as SeparatorPrimitive } from '@base-ui/react/separator';

export function Separator({ className, orientation = 'horizontal', ...props }: SeparatorProps) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:h-full data-vertical:w-px',
        className,
      )}
      {...props}
    />
  );
}
