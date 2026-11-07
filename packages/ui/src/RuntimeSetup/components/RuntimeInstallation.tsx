import type { RuntimeInfo, RuntimeSetupInfo } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { AccordionSection } from '@pitchcrew/design-system/accordion';
import { InstallProgress } from './InstallProgress.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { RuntimeUpdateAction } from '@/RuntimeMaintenance/components/RuntimeUpdateAction.tsx';
import { RuntimeUpdate } from '@/RuntimeMaintenance/components/RuntimeUpdate.tsx';
import { ExecutableSettings } from './ExecutableSettings.tsx';
import { installInProgress } from '../helpers.ts';
import type { RuntimeSetupRequest } from '../types.ts';

export const RuntimeInstallation = ({
  runtime,
  setup,
  request,
  working,
  active,
  path,
  change,
  dirty,
  save,
}: {
  runtime: RuntimeInfo;
  setup: RuntimeSetupInfo;
  request: RuntimeSetupRequest;
  working: boolean;
  active: boolean;
  path: string;
  change: (path: string) => void;
  dirty: boolean;
  save: () => Promise<void>;
}) => {
  const installing = installInProgress(setup);
  const installed = runtime.configurationError?.installationAvailable ?? runtime.available;
  const update = useWorkspaceStore((store) =>
    store.data?.runtimeMaintenance?.updates.find((entry) => entry.id === runtime.id),
  );
  const updating = !!update?.operation && !update.operation.finishedAt;
  const disabled = working || active || updating || setup.busyReasons.length > 0;
  return (
    <div className="settings-stack">
      <h3>Install and verify</h3>
      <div className="settings-callout">
        <strong>
          {installed
            ? 'Compatible installation found'
            : runtime.version
              ? 'This installation needs attention'
              : 'No installation found'}
        </strong>
        <p className="quiet">{runtime.detail}</p>
      </div>
      <p className="quiet">{setup.installDetail}</p>
      {update ? <RuntimeUpdate update={update} /> : null}
      {setup.busyReasons.length && !active ? (
        <p className="quiet">{setup.busyReasons.join(' ')}</p>
      ) : null}
      {setup.operation ? (
        installed && setup.operation.finishedAt ? (
          <AccordionSection heading="Previous installation attempt">
            <InstallProgress operation={setup.operation} request={request} working={working} />
          </AccordionSection>
        ) : (
          <InstallProgress operation={setup.operation} request={request} working={working} />
        )
      ) : null}
      <div className="settings-row-actions">
        {setup.canInstall ? (
          <Button disabled={disabled} onClick={() => void request('/install')}>
            {setup.operation?.stage === 'failed' || setup.operation?.stage === 'interrupted'
              ? 'Retry installation'
              : 'Install runtime'}
          </Button>
        ) : null}
        {update ? <RuntimeUpdateAction update={update} /> : null}
        {!installing && !updating ? (
          <Button variant="outline" disabled={disabled} onClick={() => void request('/recheck')}>
            Recheck installation
          </Button>
        ) : null}
      </div>
      <ExecutableSettings
        setup={setup}
        path={path}
        change={change}
        save={save}
        disabled={disabled}
        dirty={dirty}
      />
    </div>
  );
};
