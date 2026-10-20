import type { RuntimeUpdateInfo } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ArrowDownToLine, LoaderCircle } from 'lucide-react';
import { runtimeLabels } from '@/lib/labels.ts';

export const RuntimeUpdateAction = ({ update }: { update: RuntimeUpdateInfo }) => {
  const act = useWorkspaceStore((state) => state.act);
  const working = useWorkspaceStore((state) => state.working);
  const running = !!update.operation && !update.operation.finishedAt;
  const busy = !!update.busyReasons?.length;
  if (!running && (update.status !== 'available' || !update.canUpdate)) return null;
  const label = running
    ? 'Updating…'
    : update.operation?.stage === 'failed' || update.operation?.stage === 'interrupted'
      ? 'Retry update'
      : 'Update';
  return (
    <Button
      size="sm"
      disabled={working || busy || running}
      aria-label={`${label} ${runtimeLabels[update.id]}${!running && update.latestVersion ? ` to ${update.latestVersion}` : ''}`}
      aria-describedby={busy ? `runtime-busy-${update.id}` : undefined}
      onClick={() => act(`/runtimes/${update.id}/update`, 'POST', {}, 'Runtime update started')}
    >
      {running ? (
        <LoaderCircle
          size={14}
          aria-hidden="true"
          className="animate-spin motion-reduce:animate-none"
        />
      ) : (
        <ArrowDownToLine size={14} aria-hidden="true" />
      )}
      {label}
    </Button>
  );
};
