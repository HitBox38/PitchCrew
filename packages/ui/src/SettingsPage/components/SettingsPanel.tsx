import { Suspense, useContext, type ReactNode } from 'react';
import { TabsContent } from '@pitchcrew/design-system/tabs';
import { SettingsHeading } from './SettingsHeading.tsx';
import { SettingsErrorBoundary } from './SettingsErrorBoundary.tsx';
import { SettingsCompact } from '../layout-context.ts';

/** One section's scrolling content column; Packet rules uses the full width. */
export const SettingsPanel = ({
  value,
  wide = false,
  children,
}: {
  value: string;
  wide?: boolean;
  children: ReactNode;
}) => {
  const compact = useContext(SettingsCompact);
  return (
    <TabsContent
      className="settings-content"
      value={value}
      data-wide={wide || undefined}
      aria-labelledby={`settings-${value}-heading`}
      role={compact ? 'region' : 'tabpanel'}
    >
      <div className="settings-column">
        <SettingsHeading section={value} />
        <SettingsErrorBoundary>
          <Suspense fallback={<output className="quiet">Loading settings…</output>}>
            {children}
          </Suspense>
        </SettingsErrorBoundary>
      </div>
    </TabsContent>
  );
};
