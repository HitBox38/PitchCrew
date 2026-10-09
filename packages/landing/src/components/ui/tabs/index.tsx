'use client';

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

export function Tabs(props: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root {...props} />;
}
export function TabsList(props: TabsPrimitive.List.Props) {
  return <TabsPrimitive.List className="platform-tabs" activateOnFocus {...props} />;
}
export function TabsTrigger(props: TabsPrimitive.Tab.Props) {
  return <TabsPrimitive.Tab className="platform-tab" {...props} />;
}
export function TabsContent(props: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel className="platform-panel" {...props} />;
}
