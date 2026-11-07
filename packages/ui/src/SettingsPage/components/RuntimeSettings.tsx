import { RuntimeUpdateSettings } from '@/RuntimeMaintenance/components/RuntimeUpdateSettings.tsx';
import { RuntimeList } from './RuntimeList.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { Snapshot, RuntimeInfo } from '@pitchcrew/core';
import { lazy, Suspense, useState } from 'react';
import { RuntimeSetupLauncher } from '@/RuntimeSetup/launcher.ts';
import { RefreshCw } from 'lucide-react';
import { useRuntimeCheck } from '../hooks/useRuntimeCheck.ts';
import { lastRuntimeCheck, runtimeOverview } from '@/RuntimeMaintenance/helpers.ts';
import { settingsTime } from '@/lib/settings-time.ts';
import { SettingsSection } from './SettingsSection.tsx';
const RuntimeSetup = lazy(() =>
  import('@/RuntimeSetup/index.tsx').then((module) => ({ default: module.RuntimeSetup })),
);

export const RuntimeSettings = ({ runtimes }: { runtimes: Snapshot['runtimes'] }) => {
  const [setup, setSetup] = useState<RuntimeInfo | null>(null);
  const working = useWorkspaceStore((state) => state.working);
  const maintenance = useWorkspaceStore((state) => state.data?.runtimeMaintenance);
  const { checking, error, check } = useRuntimeCheck();
  const busy = checking || !!maintenance?.checking;
  const checked = lastRuntimeCheck(maintenance?.updates);
  const installed = runtimes.filter(
    (entry) => entry.id !== 'demo' && (entry.available || !!entry.version),
  ).length;
  return (
    <RuntimeSetupLauncher value={setSetup}>
      <SettingsSection
        id="runtime-heading"
        title="Installed runtimes"
        count={installed}
        actions={
          <>
            {checked ? <span className="ui-row-meta">Checked {settingsTime(checked)}</span> : null}
            <Button variant="outline" size="sm" disabled={working || busy} onClick={check}>
              <RefreshCw
                size={14}
                aria-hidden="true"
                className={busy ? 'animate-spin motion-reduce:animate-none' : ''}
              />
              {busy
                ? 'Checking…'
                : maintenance?.enabled
                  ? 'Check for updates'
                  : 'Recheck installations'}
            </Button>
          </>
        }
        description={runtimeOverview(runtimes, maintenance)}
      >
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <RuntimeUpdateSettings />
        <RuntimeList runtimes={runtimes} />
      </SettingsSection>
      {setup ? (
        <Suspense fallback={<output className="sr-only">Opening runtime setup…</output>}>
          <RuntimeSetup key={setup.id} runtime={setup} close={() => setSetup(null)} />
        </Suspense>
      ) : null}
    </RuntimeSetupLauncher>
  );
};
