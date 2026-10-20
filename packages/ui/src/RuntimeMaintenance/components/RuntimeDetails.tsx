import type { RuntimeInfo, RuntimeMaintenanceState, RuntimeUpdateInfo } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { RuntimeAuthentication } from './RuntimeAuthentication.tsx';
import { RefreshCw } from 'lucide-react';
import { runtimeLabels } from '@/lib/labels.ts';

export const RuntimeDetails = ({
  runtime,
  update,
  authentication,
}: {
  runtime: RuntimeInfo;
  update?: RuntimeUpdateInfo;
  authentication: RuntimeMaintenanceState['authentication'];
}) => {
  const act = useWorkspaceStore((store) => store.act);
  const working = useWorkspaceStore((store) => store.working);
  const running = !!update?.operation && !update.operation.finishedAt;
  const failed =
    update?.operation?.stage === 'failed' || update?.operation?.stage === 'interrupted';
  return (
    <div className="runtime-installation-details space-y-4 wrap-anywhere">
      <div>
        <h4 className="mb-1 text-sm font-semibold">Installation</h4>
        <p className="quiet">{runtime.detail}</p>
        {update ? <p className="quiet mt-1">{update.detail}</p> : null}
        {update?.checkedAt ? (
          <p className="quiet mt-1">
            Last checked {new Date(update.checkedAt).toLocaleString()}
            {update.lastSuccessAt && update.lastSuccessAt !== update.checkedAt
              ? `. Last verified ${new Date(update.lastSuccessAt).toLocaleString()}`
              : ''}
            .
          </p>
        ) : null}
      </div>
      {authentication.map((entry) => (
        <RuntimeAuthentication key={entry.model} model={entry.model} result={entry.result} />
      ))}
      {!authentication.length && runtime.available && runtime.id !== 'demo' ? (
        <p className="quiet">Sign-in has not been checked. Recheck after signing in to your CLI.</p>
      ) : null}
      {runtime.id !== 'demo' ? (
        <Button
          variant="outline"
          size="sm"
          disabled={working || running}
          aria-label={`Recheck ${runtimeLabels[runtime.id]}`}
          onClick={() => act(`/runtimes/${runtime.id}/recheck`, 'POST', {}, 'Runtime checked')}
        >
          <RefreshCw size={14} aria-hidden="true" /> Recheck installation and sign-in
        </Button>
      ) : null}
      {update?.manualCommand && !failed ? (
        <SourceBlock value={update.manualCommand} label="Manual update command" />
      ) : null}
    </div>
  );
};
