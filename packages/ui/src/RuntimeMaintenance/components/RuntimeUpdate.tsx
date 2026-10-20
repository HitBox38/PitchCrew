import type { RuntimeUpdateInfo } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible/index.tsx';
import { LoaderCircle } from 'lucide-react';

const stageLabels = {
  preparing: 'Preparing',
  updating: 'Updating',
  verifying: 'Verifying',
  succeeded: 'Updated',
  failed: 'Update failed',
  interrupted: 'Update interrupted',
};

export function RuntimeUpdate({ update }: { update: RuntimeUpdateInfo }) {
  const act = useWorkspaceStore((state) => state.act);
  const working = useWorkspaceStore((state) => state.working);
  const operation = update.operation;
  const running = !!operation && !operation.finishedAt;
  const busy = !!update.busyReasons?.length;
  return (
    <div className="min-w-0 space-y-2 border-t border-border pt-3 text-sm">
      <p>
        <strong>
          {update.status === 'available'
            ? `Update available: ${update.latestVersion}`
            : update.status === 'current'
              ? 'Up to date'
              : 'Update availability unknown'}
        </strong>
      </p>
      <p className="quiet">{update.detail}</p>
      {update.checkedAt ? (
        <p className="quiet">
          Last check: {new Date(update.checkedAt).toLocaleString()}
          {update.lastSuccessAt && update.lastSuccessAt !== update.checkedAt
            ? ` · Last verified: ${new Date(update.lastSuccessAt).toLocaleString()}`
            : ''}
        </p>
      ) : null}
      {operation ? (
        <div aria-live="polite" className="space-y-2">
          <p className="flex items-center gap-2">
            {running ? (
              <LoaderCircle
                className="animate-spin motion-reduce:animate-none"
                size={15}
                aria-hidden="true"
              />
            ) : null}
            <strong>{stageLabels[operation.stage]}</strong>: {operation.detail}
          </p>
          {operation.output ? (
            <Collapsible>
              <CollapsibleTrigger className="underline">Installer output</CollapsibleTrigger>
              <CollapsibleContent>
                <SourceBlock value={operation.output} label="Installer output" />
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>
      ) : null}
      {busy && !running ? (
        <p className="quiet">Update is unavailable while busy: {update.busyReasons!.join(' ')}</p>
      ) : null}
      {update.status === 'available' && update.canUpdate ? (
        <Button
          disabled={working || busy || running}
          onClick={() => act(`/runtimes/${update.id}/update`, 'POST', {}, 'Runtime update started')}
        >
          {operation?.stage === 'failed' ? 'Retry update' : 'Update'}
        </Button>
      ) : null}
      {update.manualCommand ? (
        <SourceBlock value={update.manualCommand} label="Manual update command" />
      ) : null}
    </div>
  );
}
