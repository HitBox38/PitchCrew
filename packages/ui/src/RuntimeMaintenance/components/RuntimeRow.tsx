import { useState } from 'react';
import type { RuntimeInfo } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useSearch } from '@tanstack/react-router';
import { Button } from '@pitchcrew/design-system/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
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
      className="settings-runtime"
      data-selected={selected === runtime.id || undefined}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="settings-runtime-main">
          <div className="min-w-0 flex-1 basis-60">
            <div className="settings-runtime-name">
              <h3>{label}</h3>
              <span className="ui-row-meta wrap-anywhere tabular-nums">
                {runtime.version || 'Not installed'}
              </span>
            </div>
            <RuntimeSummary runtime={runtime} update={update} authentication={authentication} />
          </div>
          <div className="settings-row-actions">
            {update ? <RuntimeUpdateAction update={update} /> : null}
            <CollapsibleTrigger
              render={<Button variant="ghost" size="sm" />}
              aria-label={`${missingAuth ? 'Set up' : manual ? 'Update instructions for' : 'Details for'} ${label}`}
            >
              {missingAuth ? 'Set up' : manual ? 'Update instructions' : 'Details'}
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
