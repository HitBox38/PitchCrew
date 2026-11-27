import { Link } from '@tanstack/react-router';
import type { CrewStatus } from '@/CrewPage/types.ts';
// The lens names the same reasons on an agent's row, in these words.
import { startBlockTitles as titles } from '@/lib/agent-start.ts';

type SetupStatus = Extract<CrewStatus, { kind: 'paused' | 'unavailable' | 'signin' }>;

/** A paused agent or a runtime it cannot use yet, with the Settings section that fixes it. */
export const CrewStatusSetup = ({ status }: { status: SetupStatus }) => {
  const cause =
    status.kind === 'paused'
      ? status.cause
      : {
          text:
            status.kind === 'signin'
              ? `Sign in to ${status.runtimeName}.`
              : `${status.runtimeName} isn’t installed.`,
          section: 'runtimes' as const,
          runtime: status.runtime,
        };
  return (
    <div className="crew-status" data-kind={status.kind}>
      <strong>{titles[status.kind]}</strong>
      {cause ? (
        <span className="crew-status-phase">
          {cause.text}{' '}
          <Link
            to="/settings"
            search={{
              section: cause.section,
              ...(cause.runtime ? { runtime: cause.runtime } : {}),
            }}
            className="text-button"
          >
            {cause.section === 'accounts' ? 'Connect' : 'Set up'}
          </Link>
        </span>
      ) : null}
    </div>
  );
};
