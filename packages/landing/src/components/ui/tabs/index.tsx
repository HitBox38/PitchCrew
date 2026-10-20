'use client';

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

export const Tabs = (props: TabsPrimitive.Root.Props) => {
  return <TabsPrimitive.Root {...props} />;
};
export const TabsList = (props: TabsPrimitive.List.Props) => {
  return <TabsPrimitive.List className="platform-tabs" activateOnFocus {...props} />;
};
export const TabsTrigger = (props: TabsPrimitive.Tab.Props) => {
  return <TabsPrimitive.Tab className="platform-tab" {...props} />;
};
export const TabsContent = (props: TabsPrimitive.Panel.Props) => {
  return <TabsPrimitive.Panel className="platform-panel" {...props} />;
};
