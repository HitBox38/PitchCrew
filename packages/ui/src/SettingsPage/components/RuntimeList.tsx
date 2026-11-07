import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { RuntimeRow } from '@/RuntimeMaintenance/components/RuntimeRow.tsx';
import type { Snapshot } from '@pitchcrew/core';
import { ChevronDown } from 'lucide-react';
import { useSearch } from '@tanstack/react-router';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { runtimeNeedsAttention } from '@/RuntimeMaintenance/helpers.ts';

const RuntimeRows = ({ runtimes }: { runtimes: Snapshot['runtimes'] }) => {
  const { runtime: selected } = useSearch({ from: '/settings' });
  return (
    <div className="settings-list">
      {runtimes.map((runtime) => (
        <RuntimeRow key={`${runtime.id}-${selected === runtime.id}`} runtime={runtime} />
      ))}
    </div>
  );
};

export const RuntimeList = ({ runtimes }: { runtimes: Snapshot['runtimes'] }) => {
  const { runtime: selected } = useSearch({ from: '/settings' });
  const maintenance = useWorkspaceStore((state) => state.data?.runtimeMaintenance);
  const priority = (runtime: Snapshot['runtimes'][number]) => {
    const update = maintenance?.updates.find((entry) => entry.id === runtime.id);
    if (runtimeNeedsAttention(runtime, maintenance)) return 0;
    if (update?.operation && !update.operation.finishedAt) return 1;
    return update?.status === 'available' ? 2 : 3;
  };
  const available = runtimes
    .filter(
      (runtime) =>
        runtime.id !== 'demo' &&
        (runtime.available || !!runtime.version || runtimeNeedsAttention(runtime, maintenance)),
    )
    .sort((a, b) => priority(a) - priority(b));
  const unavailable = runtimes.filter(
    (runtime) =>
      runtime.id !== 'demo' &&
      !runtime.available &&
      !runtime.version &&
      !runtimeNeedsAttention(runtime, maintenance),
  );
  const demo = runtimes.find((runtime) => runtime.id === 'demo');
  return (
    <div className="settings-stack">
      {available.length ? (
        <RuntimeRows runtimes={available} />
      ) : (
        <p className="ui-empty">No agent CLIs found. Add another runtime below for setup steps.</p>
      )}
      {unavailable.length ? (
        <Collapsible
          key={unavailable.some((entry) => entry.id === selected) ? selected : 'other'}
          className="settings-disclosure"
          defaultOpen={unavailable.some((entry) => entry.id === selected)}
        >
          <CollapsibleTrigger className="settings-disclosure-trigger">
            <ChevronDown size={16} aria-hidden="true" /> Add another runtime
            <span className="ui-count">{unavailable.length} supported</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <RuntimeRows runtimes={unavailable} />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {demo ? (
        <Collapsible className="settings-disclosure">
          <CollapsibleTrigger className="settings-disclosure-trigger">
            <ChevronDown size={16} aria-hidden="true" /> Development demo
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="settings-list">
              <RuntimeRow runtime={demo} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
};
