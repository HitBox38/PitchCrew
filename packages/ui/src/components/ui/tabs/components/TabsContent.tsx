import type { TabsContentProps } from '@/components/ui/tabs/types.ts';
import { cn } from '@/lib/utils';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

export function TabsContent({ className, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn('primitive:flex-1 primitive:outline-none', className)}
      {...props}
    />
  );
}
