import { RuntimeUpdateSettings } from '@/RuntimeMaintenance/components/RuntimeUpdateSettings.tsx';
import { RuntimeList } from './RuntimeList.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { Snapshot } from '@pitchcrew/core';
import { Link } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';
import { useRuntimeCheck } from '../hooks/useRuntimeCheck.ts';
import { runtimeUpdateCount } from '@/RuntimeMaintenance/helpers.ts';

export const RuntimeSettings = ({ runtimes }: { runtimes: Snapshot['runtimes'] }) => {
  const working = useWorkspaceStore((state) => state.working);
  const maintenance = useWorkspaceStore((state) => state.data?.runtimeMaintenance);
  const { checking, error, check } = useRuntimeCheck();
  const updates = runtimeUpdateCount(runtimes, maintenance?.updates);
  const installed = runtimes.filter(
    (entry) => entry.id !== 'demo' && (entry.available || !!entry.version),
  ).length;
  return (
    <section className="settings-section settings-runtimes">
      <header className="settings-runtime-toolbar flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <h2>Runtimes</h2>
          <p className="quiet max-w-[58ch]">
            Manage the agent CLIs installed on this machine. Choose which runtime each agent uses in{' '}
            <Link className="underline underline-offset-2" to="/crew">
              Crew
            </Link>
            .
          </p>
        </div>
        <Button
          variant="outline"
          disabled={working || checking || maintenance?.checking}
          onClick={check}
        >
          <RefreshCw
            size={15}
            aria-hidden="true"
            className={
              checking || maintenance?.checking ? 'animate-spin motion-reduce:animate-none' : ''
            }
          />{' '}
          {checking || maintenance?.checking
            ? 'Checking…'
            : maintenance?.enabled
              ? 'Check for updates'
              : 'Recheck installations'}
        </Button>
      </header>
      <div className="runtime-overview" aria-live="polite">
        <span>
          <strong>{installed}</strong> installed
        </span>
        <span>
          {!maintenance?.enabled ? (
            'Release checks are disabled in this installation.'
          ) : updates ? (
            <>
              <strong>{updates}</strong> {updates === 1 ? 'update available' : 'updates available'}
            </>
          ) : (
            'Updates install only when you choose.'
          )}
        </span>
      </div>
      {error ? (
        <p className="form-error mb-4" role="alert">
          {error}
        </p>
      ) : null}
      <RuntimeList runtimes={runtimes} />
      <div className="runtime-update-preferences">
        <RuntimeUpdateSettings />
      </div>
    </section>
  );
};
