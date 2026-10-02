import { tabsListVariants } from '@/components/ui/tabs/constants.ts';
import type { TabsListProps } from '@/components/ui/tabs/types.ts';
import { cn } from '@/lib/utils';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

export function TabsList({ className, variant = 'default', ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}
