'use client';

import {
  Tabs as SharedTabs,
  TabsList as SharedTabsList,
  TabsTrigger as SharedTabsTrigger,
  TabsContent as SharedTabsContent,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentProps,
} from '@pitchcrew/design-system/tabs';
import { cn } from '@pitchcrew/design-system/utils';

export const Tabs = ({ className, ...props }: TabsProps) => {
  return <SharedTabs className={cn('gap-0', className)} {...props} />;
};
export const TabsList = ({ className, ...props }: TabsListProps) => {
  return (
    <SharedTabsList
      className={cn('platform-tabs h-auto w-full', className)}
      activateOnFocus
      {...props}
    />
  );
};
export const TabsTrigger = ({ className, ...props }: TabsTriggerProps) => {
  return <SharedTabsTrigger className={cn('platform-tab h-auto border-0', className)} {...props} />;
};
export const TabsContent = ({ className, ...props }: TabsContentProps) => {
  return <SharedTabsContent className={cn('platform-panel', className)} {...props} />;
};
