import { useContext } from 'react';
import type { RuntimeInfo, RuntimeUpdateInfo } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { CollapsibleTrigger } from '@pitchcrew/design-system/collapsible';
import { ChevronDown } from 'lucide-react';
import { runtimeLabels } from '@/lib/labels.ts';
import { RuntimeUpdateAction } from './RuntimeUpdateAction.tsx';
import { RuntimeSetupLauncher } from '@/RuntimeSetup/launcher.ts';

export const RuntimeActions = ({
  runtime,
  update,
  open,
  needsSetup,
  manual,
}: {
  runtime: RuntimeInfo;
  update?: RuntimeUpdateInfo;
  open: boolean;
  needsSetup: boolean;
  manual: boolean;
}) => {
  const showSetup = useContext(RuntimeSetupLauncher);
  const label = runtimeLabels[runtime.id];
  return (
    <div className="settings-row-actions">
      {runtime.id !== 'demo' ? (
        <Button
          variant={needsSetup ? 'outline' : 'ghost'}
          size="sm"
          id={`runtime-${runtime.id}-setup`}
          onClick={() => showSetup?.(runtime)}
          aria-label={`${needsSetup ? 'Set up' : 'Manage'} ${label}`}
        >
          {needsSetup ? 'Set up' : 'Manage'}
        </Button>
      ) : null}
      <CollapsibleTrigger
        render={<Button variant="ghost" size="sm" />}
        aria-label={`${manual ? 'Update instructions for' : 'Details for'} ${label}`}
      >
        {manual ? 'Update instructions' : 'Details'}
        <ChevronDown size={14} aria-hidden="true" className={open ? 'rotate-180' : ''} />
      </CollapsibleTrigger>
      {update ? <RuntimeUpdateAction update={update} /> : null}
    </div>
  );
};
