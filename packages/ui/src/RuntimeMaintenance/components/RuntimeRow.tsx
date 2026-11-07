import { useState } from 'react';
import type { RuntimeInfo } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useSearch } from '@tanstack/react-router';
import { Collapsible, CollapsibleContent } from '@pitchcrew/design-system/collapsible';
import { runtimeLabels } from '@/lib/labels.ts';
import { RuntimeUpdate } from './RuntimeUpdate.tsx';
import { RuntimeActions } from './RuntimeActions.tsx';
import { RuntimeDetails } from './RuntimeDetails.tsx';
import { RuntimeSummary } from './RuntimeSummary.tsx';
import { runtimeNeedsAttention, runtimeVersionLabel } from '../helpers.ts';

export const RuntimeRow = ({ runtime }: { runtime: RuntimeInfo }) => {
  const state = useWorkspaceStore((store) => store.data?.runtimeMaintenance);
  const { runtime: selected } = useSearch({ from: '/settings' });
  const [open, setOpen] = useState(selected === runtime.id);
  const update = state?.updates.find((entry) => entry.id === runtime.id);
  const authentication =
    state?.authentication.filter((entry) => entry.runtime === runtime.id) ?? [];
  const missingAuth = authentication.some((entry) => entry.result.status === 'missing');
  const incompatible = !!runtime.version && !runtime.available && !runtime.configurationError;
  const needsAttention = runtimeNeedsAttention(runtime, state);
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
      data-attention={needsAttention || undefined}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="settings-runtime-main">
          <div className="min-w-0 flex-1 basis-60">
            <div className="settings-runtime-name">
              <h4>{label}</h4>
              <span className="ui-row-meta wrap-anywhere tabular-nums">
                {runtimeVersionLabel(runtime.version)}
              </span>
            </div>
            <RuntimeSummary runtime={runtime} update={update} authentication={authentication} />
            {incompatible ? <p className="quiet mt-2">{runtime.detail}</p> : null}
          </div>
          <RuntimeActions
            runtime={runtime}
            update={update}
            open={open}
            needsSetup={!runtime.configurationError && (missingAuth || !runtime.available)}
            manual={manual}
          />
        </div>
        {update ? <RuntimeUpdate update={update} /> : null}
        <CollapsibleContent>
          <RuntimeDetails runtime={runtime} update={update} authentication={authentication} />
        </CollapsibleContent>
      </Collapsible>
    </article>
  );
};
