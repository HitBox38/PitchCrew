import { ConversationSelect } from '@/ChatView/components/ConversationSelect.tsx';
import type { BrowserMode } from '@pitchcrew/core';
import type { RoleSettingsModel } from '../types.ts';

export const BrowserSettings = ({
  capabilities,
  browserMode,
  setBrowserMode,
}: Pick<RoleSettingsModel, 'capabilities' | 'browserMode' | 'setBrowserMode'>) => {
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
          { value: 'autonomous', label: 'Autonomous preparation' },
        ]}
        onChange={(value) => setBrowserMode(value as BrowserMode)}
      />
      <p className="quiet">
        Override this default per conversation. Autonomous preparation requires task site access and
        a recognized application form. Buttons, keys, dialogs and final submission always ask.
        Scheduled routines stay supervised.
      </p>
    </section>
  );
};
