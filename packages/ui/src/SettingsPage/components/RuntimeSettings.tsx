import { RuntimeUpdateSettings } from '@/RuntimeMaintenance/components/RuntimeUpdateSettings.tsx';
import { RuntimeList } from './RuntimeList.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { Snapshot } from '@pitchcrew/core';
import { Link } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';
import { useRuntimeCheck } from '../hooks/useRuntimeCheck.ts';
import { lastRuntimeCheck, runtimeUpdateCount } from '@/RuntimeMaintenance/helpers.ts';
import { SettingsSection } from './SettingsSection.tsx';

export const RuntimeSettings = ({ runtimes }: { runtimes: Snapshot['runtimes'] }) => {
  const working = useWorkspaceStore((state) => state.working);
  const maintenance = useWorkspaceStore((state) => state.data?.runtimeMaintenance);
  const { checking, error, check } = useRuntimeCheck();
  const updates = runtimeUpdateCount(runtimes, maintenance?.updates);
  const busy = checking || !!maintenance?.checking;
  const checked = lastRuntimeCheck(maintenance?.updates);
  const installed = runtimes.filter(
    (entry) => entry.id !== 'demo' && (entry.available || !!entry.version),
  ).length;
  return (
    <>
      <SettingsSection
        id="runtime-heading"
        title="Installed runtimes"
        count={installed}
        actions={
          <>
            {checked ? (
              <span className="ui-row-meta">
                Checked {new Date(checked).toLocaleString([], dateTime)}
              </span>
            ) : null}
            <Button variant="outline" size="sm" disabled={working || busy} onClick={check}>
              <RefreshCw
                size={14}
                aria-hidden="true"
                className={busy ? 'animate-spin motion-reduce:animate-none' : ''}
              />
              {busy ? 'Checking…' : 'Check now'}
            </Button>
          </>
        }
        description={
          <span aria-live="polite">
            {!maintenance?.enabled
              ? 'Release checks are disabled in this installation. '
              : updates
                ? `${updates} ${updates === 1 ? 'update' : 'updates'} available. Updates install only when you choose. `
                : 'Updates install only when you choose. '}
            Choose each agent’s runtime in{' '}
            <Link className="underline underline-offset-2" to="/crew">
              Crew
            </Link>
            .
          </span>
        }
      >
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <RuntimeList runtimes={runtimes} />
      </SettingsSection>
      <SettingsSection id="runtime-checks-heading" title="Update checks">
        <RuntimeUpdateSettings />
      </SettingsSection>
    </>
  );
};

const dateTime: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
