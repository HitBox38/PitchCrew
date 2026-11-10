import type { TabsIndicatorProps } from '../types.ts';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

/** The chosen tab's clay pebble. Place it inside a TabsList; its tabs then paint no fill of their own. */
export const TabsIndicator = (props: TabsIndicatorProps) => {
  return <TabsPrimitive.Indicator data-slot="tabs-indicator" {...props} />;
};
