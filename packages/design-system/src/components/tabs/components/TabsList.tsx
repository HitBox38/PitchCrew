import { tabsListVariants } from '../constants.ts';
import type { TabsListProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { Children, isValidElement } from 'react';
import { TabsIndicator } from './TabsIndicator.tsx';

export const TabsList = ({ className, variant = 'default', ...props }: TabsListProps) => {
  // Styles key off `data-indicator`, not `:has()`, which Chrome rechecked after every change.
  const indicator = Children.toArray(props.children).some(
    (child) => isValidElement(child) && child.type === TabsIndicator,
  );
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      data-indicator={indicator ? '' : undefined}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
};
