import type { TabsProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

export const Tabs = ({ className, orientation = 'horizontal', ...props }: TabsProps) => {
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
};
