import { Button } from '@pitchcrew/design-system/button';
import { Input } from '@pitchcrew/design-system/input';
import { AccordionSection } from '@pitchcrew/design-system/accordion';
import type { RuntimeSetupInfo } from '@pitchcrew/core';

export const ExecutableSettings = ({
  setup,
  path,
  change,
  save,
  disabled,
  dirty,
}: {
  setup: RuntimeSetupInfo;
  path: string;
  change: (path: string) => void;
  save: () => Promise<void>;
  disabled: boolean;
  dirty: boolean;
}) => (
  <AccordionSection heading="Executable location" className="settings-disclosure">
    <div className="settings-stack pt-3">
      <dl className="runtime-location">
        <dt>Active executable</dt>
        <dd>{setup.executable || 'Not found'}</dd>
        <dt>Selected by</dt>
        <dd>
          {setup.source === 'automatic'
            ? 'Automatic detection'
            : setup.source === 'managed'
              ? 'Pitchcrew installation'
              : 'Custom path'}
        </dd>
        <dt>Installer</dt>
        <dd>{setup.installer || 'Unknown'}</dd>
        {setup.realPath && setup.realPath !== setup.executable ? (
          <>
            <dt>Resolved location</dt>
            <dd>{setup.realPath}</dd>
          </>
        ) : null}
      </dl>
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label htmlFor={`runtime-path-${setup.id}`}>Custom executable path (optional)</label>
        <Input
          id={`runtime-path-${setup.id}`}
          value={path}
          disabled={disabled}
          onChange={(event) => change(event.target.value)}
          placeholder="Leave empty for automatic detection"
          autoComplete="off"
          spellCheck={false}
          maxLength={2048}
        />
        <p className="quiet">
          Use an absolute path on the computer running Pitchcrew. Saved changes apply to checks,
          models and future runs in this workspace.
        </p>
        <div className="settings-form-actions">
          <Button variant="ghost" disabled={disabled || !path} onClick={() => change('')}>
            Clear custom path
          </Button>
          <Button type="submit" variant="outline" disabled={disabled || !dirty}>
            Save executable path
          </Button>
        </div>
      </form>
    </div>
  </AccordionSection>
);
