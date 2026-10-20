import type { RuntimeUpdateInfo } from '@pitchcrew/core';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible/index.tsx';
import { CircleCheck, CircleAlert, LoaderCircle } from 'lucide-react';

export const RuntimeUpdate = ({ update }: { update: RuntimeUpdateInfo }) => {
  const operation = update.operation;
  const running = !!operation && !operation.finishedAt;
  const busy = !!update.busyReasons?.length;
  const failed = operation?.stage === 'failed' || operation?.stage === 'interrupted';
  return (
    <div className="text-sm">
      {operation ? (
        <div
          aria-live="polite"
          className={`runtime-operation ${failed ? 'runtime-operation-failed' : ''}`}
        >
          <div className="flex items-start gap-2">
            {running ? (
              <LoaderCircle
                className="mt-0.5 shrink-0 animate-spin motion-reduce:animate-none"
                size={16}
                aria-hidden="true"
              />
            ) : failed ? (
              <CircleAlert className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
            ) : (
              <CircleCheck className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
            )}
            <div className="min-w-0 space-y-1 wrap-anywhere">
              <p className="font-semibold">{stageLabels[operation.stage]}</p>
              <p className="quiet">{operation.detail}</p>
              {running ? (
                <p className="quiet">
                  You can leave this page. Queued work resumes after verification.
                </p>
              ) : null}
            </div>
          </div>
          {failed && update.manualCommand ? (
            <div className="mt-3 space-y-2">
              <p className="quiet">
                Run this command in your terminal to update manually, then recheck the runtime.
              </p>
              <SourceBlock value={update.manualCommand} label="Manual update command" />
            </div>
          ) : null}
          {operation.output ? (
            <Collapsible className="mt-2">
              <CollapsibleTrigger className="runtime-text-trigger">
                Installer output
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SourceBlock value={operation.output} label="Installer output" />
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>
      ) : null}
      {busy && !running && update.status === 'available' ? (
        <p id={`runtime-busy-${update.id}`} className="quiet mt-3" aria-live="polite">
          Wait until this runtime is idle to update. {update.busyReasons!.join(' ')}
        </p>
      ) : null}
    </div>
  );
};

const stageLabels = {
  preparing: 'Preparing update…',
  updating: 'Installing update…',
  verifying: 'Verifying installation…',
  succeeded: 'Runtime updated',
  failed: 'Update failed',
  interrupted: 'Update interrupted',
};
