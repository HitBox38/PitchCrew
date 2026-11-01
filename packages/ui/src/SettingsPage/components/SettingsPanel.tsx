import type { ReactNode } from 'react';
import { TabsContent } from '@/components/ui/tabs/components/TabsContent.tsx';

/** One section's scrolling content column; Packet rules uses the full width. */
export const SettingsPanel = ({
  value,
  wide = false,
  children,
}: {
  value: string;
  wide?: boolean;
  children: ReactNode;
}) => (
  <TabsContent className="settings-content" value={value} data-wide={wide || undefined}>
    <div className="settings-column">{children}</div>
  </TabsContent>
);
