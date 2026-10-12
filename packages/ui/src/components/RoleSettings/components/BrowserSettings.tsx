import { ConversationSelect } from '@/ChatView/components/ConversationSelect.tsx';
import type { BrowserMode } from '@pitchcrew/core';
import type { RoleSettingsModel } from '../types.ts';

export function BrowserSettings({
  capabilities,
  browserMode,
  setBrowserMode,
}: Pick<RoleSettingsModel, 'capabilities' | 'browserMode' | 'setBrowserMode'>) {
  if (!capabilities.computerUse) return null;
  return (
    <section className="role-settings-section grid gap-3">
      <h3>Browser permissions</h3>
      <ConversationSelect
        compact={false}
        label="Default browser permissions"
        value={browserMode}
        items={[
          { value: 'supervised', label: 'Supervised' },
          { value: 'autonomous', label: 'Autonomous browsing' },
        ]}
        onChange={(value) => setBrowserMode(value as BrowserMode)}
      />
      <p className="quiet">
        Override this default per conversation. Autonomous preparation requires task site access and
        a recognized application form. Final submission always asks. Scheduled routines stay
        supervised.
      </p>
    </section>
  );
}
