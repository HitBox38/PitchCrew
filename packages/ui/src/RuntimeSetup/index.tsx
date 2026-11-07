import { useState } from 'react';
import { Modal } from '@/components/Modal/index.tsx';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { Button } from '@pitchcrew/design-system/button';
import { Tabs } from '@pitchcrew/design-system/tabs';
import { runtimeLabels } from '@/lib/labels.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useRuntimeSetup } from './hooks/useRuntimeSetup.ts';
import { SetupPanels } from './components/SetupPanels.tsx';
import { SetupSections } from './components/SetupSections.tsx';
import { SetupFooter } from './components/SetupFooter.tsx';
import { installInProgress } from './helpers.ts';
import { initialSetupSection } from './sections.ts';
import type { RuntimeSetupProps } from './types.ts';

/** Drafts survive section changes; only the user can start native setup. */
export const RuntimeSetup = ({ runtime: initialRuntime, close }: RuntimeSetupProps) => {
  const data = useWorkspaceStore((store) => store.data);
  const runtime = data?.runtimes.find((entry) => entry.id === initialRuntime.id) ?? initialRuntime;
  const results =
    data?.runtimeMaintenance?.authentication.filter((entry) => entry.runtime === runtime.id) ?? [];
  const signedIn =
    !!results.length && results.every((entry) => entry.result.status === 'authenticated');
  const model = useRuntimeSetup(runtime.id);
  const [section, setSection] = useState(() => initialSetupSection(runtime, signedIn));
  const [modelsVisited, setModelsVisited] = useState(section === 'models');
  if (section === 'models' && !modelsVisited) setModelsVisited(true);
  const [modelsDirty, setModelsDirty] = useState(false);
  const guard = useUnsavedChanges(model.dirty || modelsDirty || model.connectionDirty, close);
  const leave = (action: () => void) =>
    guard.requestLeave(() => {
      close();
      action();
    });
  const dismiss = () => {
    if (!model.working) guard.requestLeave(close);
  };
  return (
    <>
      <Modal
        title={`Set up ${runtimeLabels[runtime.id]}`}
        onClose={dismiss}
        closeDisabled={model.working}
        finalFocus={() => document.getElementById(`runtime-${runtime.id}-setup`)}
        className="runtime-setup-dialog"
      >
        <p className="quiet runtime-setup-intro">
          Install, connect your account and manage models for this workspace.
        </p>
        <Tabs
          value={section}
          onValueChange={(value) => setSection(String(value))}
          className="runtime-setup-tabs"
        >
          <SetupSections
            runtime={model.catalog ? { ...runtime, ...model.catalog } : runtime}
            auth={model.data?.auth}
            signedIn={signedIn}
            installing={installInProgress(model.data?.setup)}
          />
          <div className="runtime-setup-body">
            {model.error ? (
              <div role="alert" className="form-error">
                <p>{model.error}</p>
                <Button variant="outline" size="sm" disabled={model.working} onClick={model.retry}>
                  Retry connection
                </Button>
              </div>
            ) : null}
            {!model.data && !model.error ? (
              <output className="quiet">Checking runtime setup…</output>
            ) : null}
            <SetupPanels
              runtime={runtime}
              model={model}
              onModelsDirty={setModelsDirty}
              leave={leave}
              modelsVisited={modelsVisited}
              section={section}
              onCatalogChange={model.setCatalog}
            />
          </div>
        </Tabs>
        <SetupFooter
          section={section}
          ready={runtime.configurationError?.installationAvailable ?? runtime.available}
          signedIn={signedIn}
          working={model.working}
          loaded={!!model.data}
          secondary={modelsDirty}
          recovery={!!runtime.configurationError || !!model.data?.auth.configurationError}
          select={setSection}
          close={dismiss}
        />
      </Modal>
      <DiscardChanges guard={guard} />
    </>
  );
};
