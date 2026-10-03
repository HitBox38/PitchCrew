import type { TabsProps } from '@/components/ui/tabs/types.ts';
import { cn } from '@/lib/utils';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

export function Tabs({ className, orientation = 'horizontal', ...props }: TabsProps) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        'group/tabs primitive:flex primitive:gap-2 primitive:data-horizontal:flex-col',
        className,
      )}
      {...props}
    />
  );
}
