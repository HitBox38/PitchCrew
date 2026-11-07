import type { RuntimeInfo, RuntimeModelCatalog } from '@pitchcrew/core';
import { TabsContent } from '@pitchcrew/design-system/tabs';
import { RuntimeModels } from '@/RuntimeModels/index.tsx';
import { RuntimeInstallation } from './RuntimeInstallation.tsx';
import { RuntimeSignIn } from './RuntimeSignIn.tsx';
import { RuntimeAssignments } from './RuntimeAssignments.tsx';
import type { useRuntimeSetup } from '../hooks/useRuntimeSetup.ts';

export const SetupPanels = ({
  runtime,
  model,
  onModelsDirty,
  leave,
  modelsVisited,
  section,
  onCatalogChange,
}: {
  runtime: RuntimeInfo;
  model: ReturnType<typeof useRuntimeSetup>;
  onModelsDirty: (dirty: boolean) => void;
  leave: (action: () => void) => void;
  modelsVisited: boolean;
  section: string;
  onCatalogChange: (catalog: RuntimeModelCatalog) => void;
}) => {
  if (!model.data) return null;
  const { setup, auth } = model.data;
  return (
    <>
      <TabsContent value="installation" keepMounted>
        <RuntimeInstallation
          runtime={runtime}
          setup={setup}
          request={model.request}
          working={model.working}
          active={model.active}
          path={model.path}
          change={model.setDraft}
          dirty={model.dirty}
          save={model.savePath}
        />
      </TabsContent>
      <TabsContent value="signin" keepMounted>
        <RuntimeSignIn
          runtime={runtime}
          auth={auth}
          request={model.request}
          working={model.working}
          active={model.active}
          busy={setup.busyReasons.length > 0}
          visible={section === 'signin'}
          onConnectionDirty={model.setConnectionDirty}
          onConnectionWorking={model.setConnectionWorking}
          connectionDirty={model.connectionDirty}
          connectionRevision={model.connectionRevision}
          onConnectionSaved={model.connectionSaved}
          refreshSetup={model.refresh}
        />
      </TabsContent>
      <TabsContent value="models" keepMounted>
        {modelsVisited ? (
          <RuntimeModels
            runtime={runtime}
            onDirtyChange={onModelsDirty}
            onCatalogChange={onCatalogChange}
          />
        ) : null}
        <RuntimeAssignments runtime={runtime} leave={leave} />
      </TabsContent>
    </>
  );
};
