import { useState } from 'react';
import type { RuntimeInfo } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useSearch } from '@tanstack/react-router';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible/index.tsx';
import { runtimeLabels } from '@/lib/labels.ts';
import { ChevronDown } from 'lucide-react';
import { RuntimeUpdate } from './RuntimeUpdate.tsx';
import { RuntimeUpdateAction } from './RuntimeUpdateAction.tsx';
import { RuntimeDetails } from './RuntimeDetails.tsx';
import { RuntimeSummary } from './RuntimeSummary.tsx';

export const RuntimeRow = ({ runtime }: { runtime: RuntimeInfo }) => {
  const state = useWorkspaceStore((store) => store.data?.runtimeMaintenance);
  const { runtime: selected } = useSearch({ from: '/settings' });
  const [open, setOpen] = useState(selected === runtime.id);
  const update = state?.updates.find((entry) => entry.id === runtime.id);
  const authentication =
    state?.authentication.filter((entry) => entry.runtime === runtime.id) ?? [];
  const missingAuth = authentication.some((entry) => entry.result.status === 'missing');
  const running = !!update?.operation && !update.operation.finishedAt;
  const manual = update?.status === 'available' && !update.canUpdate && !running;
  const label = runtimeLabels[runtime.id];
  return (
    <article
      id={`runtime-${runtime.id}`}
      aria-label={label}
      tabIndex={-1}
      className={`runtime-installation ${selected === runtime.id ? 'ring-2 ring-ring' : ''}`}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1 basis-52">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3>{label}</h3>
              <span className="quiet text-sm wrap-anywhere tabular-nums">
                {runtime.version || 'Not installed'}
              </span>
            </div>
            <RuntimeSummary runtime={runtime} update={update} authentication={authentication} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {update ? <RuntimeUpdateAction update={update} /> : null}
            <CollapsibleTrigger
              render={<Button variant="outline" size="sm" />}
              aria-label={`${missingAuth ? 'Set up' : manual ? 'Update instructions for' : 'Details for'} ${label}`}
            >
              {missingAuth ? 'Set up' : manual && !running ? 'Update instructions' : 'Details'}
              <ChevronDown size={14} aria-hidden="true" className={open ? 'rotate-180' : ''} />
            </CollapsibleTrigger>
          </div>
        </div>
        {update ? <RuntimeUpdate update={update} /> : null}
        <CollapsibleContent>
          <RuntimeDetails runtime={runtime} update={update} authentication={authentication} />
        </CollapsibleContent>
      </Collapsible>
    </article>
  );
};
