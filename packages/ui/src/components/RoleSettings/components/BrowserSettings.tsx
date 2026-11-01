import { FormSelect } from '@/FormSelect/index.tsx';
import type { BrowserMode } from '@pitchcrew/core';
import type { RoleSettingsModel } from '../types.ts';

/** Default browser permission; conversations can override it and routines stay supervised. */
export const BrowserSettings = ({
  capabilities,
  browserMode,
  setBrowserMode,
}: Pick<RoleSettingsModel, 'capabilities' | 'browserMode' | 'setBrowserMode'>) => {
  if (!capabilities.computerUse) return null;
  return (
    <section
      className="agent-panel-section"
      id="agent-browser"
      aria-labelledby="agent-browser-heading"
    >
      <h3 id="agent-browser-heading">Browser permissions</h3>
      <FormSelect
        label="Default browser permissions"
        value={browserMode}
        options={[
          { value: 'supervised', label: 'Supervised' },
          { value: 'autonomous', label: 'Autonomous preparation' },
        ]}
        onValueChange={(value) => setBrowserMode(value as BrowserMode)}
      />
      <p className="optional">
        Each conversation can override this. Autonomous preparation needs task site access and a
        recognized application form. Buttons, keys, dialogs and final submission always ask.
        Scheduled routines stay supervised.
      </p>
    </section>
  );
};
