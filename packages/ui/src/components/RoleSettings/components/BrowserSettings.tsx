import { FormSelect } from '@/FormSelect/index.tsx';
import { browserModeSummaries } from '@pitchcrew/core/browser-modes';
import { browserModeOptions } from '@/lib/browser-modes.ts';
import type { RoleSettingsModel } from '../types.ts';

/**
 * Default browser permission, with what the chosen mode does on its own; conversations can
 * override it and routines stay supervised.
 */
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
        options={browserModeOptions}
        onValueChange={setBrowserMode}
        describedBy="agent-browser-summary"
      />
      <p className="optional" id="agent-browser-summary" aria-live="polite">
        {browserModeSummaries[browserMode]}
      </p>
      <p className="optional">
        Each conversation can override this. Scheduled routines stay supervised.
      </p>
    </section>
  );
};
