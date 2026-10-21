import type { RuntimeUpdateInfo } from '@pitchcrew/core';
import { RuntimeOperation } from './RuntimeOperation.tsx';

export const RuntimeUpdate = ({ update }: { update: RuntimeUpdateInfo }) => {
  const operation = update.operation;
  const running = !!operation && !operation.finishedAt;
  const busy = !!update.busyReasons?.length;
  return (
    <div className="text-sm">
      <RuntimeOperation update={update} />
      {busy && !running && update.status === 'available' ? (
        <p id={`runtime-busy-${update.id}`} className="quiet mt-3" aria-live="polite">
          Wait until this runtime is idle to update. {update.busyReasons!.join(' ')}
        </p>
      ) : null}
    </div>
  );
};
