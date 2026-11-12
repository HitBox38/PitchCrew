import { memo } from 'react';
import type { TabsIndicatorProps } from '../types.ts';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

/**
 * The chosen tab's clay pebble. Place it inside a TabsList; its tabs then paint no fill of their own.
 * Base UI measures the tabs while it renders, so a parent's re-render would force a page layout;
 * it still re-measures when the selection changes or the tabs resize.
 */
export const TabsIndicator = memo((props: TabsIndicatorProps) => {
  return <TabsPrimitive.Indicator data-slot="tabs-indicator" {...props} />;
});
