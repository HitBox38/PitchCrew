import type { CrewStatus } from '@/CrewPage/types.ts';
import { CrewStatusLive } from './CrewStatusLive.tsx';
import { CrewStatusSetup } from './CrewStatusSetup.tsx';

/**
 * The recessed line under each agent: live work, a waiting browser request or question, the
 * setup that stops it, or one idle sentence.
 */
export const CrewStatusTray = ({ status, name }: { status: CrewStatus; name: string }) => {
  if (status.kind === 'idle')
    return (
      <div className="crew-status" data-kind="idle">
        {status.fact}
      </div>
    );
  if (status.kind === 'working' || status.kind === 'approving' || status.kind === 'waiting')
    return <CrewStatusLive status={status} name={name} />;
  return <CrewStatusSetup status={status} />;
};
