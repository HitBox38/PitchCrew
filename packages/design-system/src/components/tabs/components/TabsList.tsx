import { tabsListVariants } from '../constants.ts';
import type { TabsListProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

export const TabsList = ({ className, variant = 'default', ...props }: TabsListProps) => {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
};
