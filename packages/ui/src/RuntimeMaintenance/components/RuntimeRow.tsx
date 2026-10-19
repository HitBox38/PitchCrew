import type { RuntimeInfo } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useSearch } from '@tanstack/react-router';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { runtimeLabels } from '@/lib/labels.ts';
import { RuntimeAuthentication } from './RuntimeAuthentication.tsx';
import { RuntimeUpdate } from './RuntimeUpdate.tsx';

export function RuntimeRow({ runtime }: { runtime: RuntimeInfo }) {
  const state = useWorkspaceStore((store) => store.data?.runtimeMaintenance);
  const act = useWorkspaceStore((store) => store.act);
  const working = useWorkspaceStore((store) => store.working);
  const { runtime: selected } = useSearch({ from: '/settings' });
  const update = state?.updates.find((entry) => entry.id === runtime.id);
  const authentication =
    state?.authentication.filter((entry) => entry.runtime === runtime.id) ?? [];
  const updating = !!update?.operation && !update.operation.finishedAt;
  return (
    <article
      id={`runtime-${runtime.id}`}
      tabIndex={-1}
      className={`space-y-3 rounded-xl border p-4 ${selected === runtime.id ? 'ring-2 ring-ring' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{runtimeLabels[runtime.id]}</h3>
        <span className={`badge ${runtime.available ? 'success' : ''}`}>
          {runtime.available
            ? 'Installed and compatible'
            : runtime.version
              ? 'Incompatible version'
              : 'Not installed'}
        </span>
      </div>
      <p className="quiet text-sm">{runtime.version}</p>
      <p className="quiet text-sm">{runtime.detail}</p>
      {authentication.map((entry) => (
        <RuntimeAuthentication key={entry.model} model={entry.model} result={entry.result} />
      ))}
      {runtime.id !== 'demo' ? (
        <Button
          size="sm"
          disabled={working || updating}
          onClick={() => act(`/runtimes/${runtime.id}/recheck`, 'POST', {}, 'Runtime checked')}
        >
          Recheck
        </Button>
      ) : null}
      {update ? <RuntimeUpdate update={update} /> : null}
    </article>
  );
}
