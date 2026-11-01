import { Link } from '@tanstack/react-router';
import type { CrewStatus } from '@/CrewPage/types.ts';

/** The recessed line under each agent: live work opens its exact run, a question its chat. */
export const CrewStatusTray = ({ status, name }: { status: CrewStatus; name: string }) => {
  if (status.kind === 'working') {
    const body = (
      <>
        <span className="crew-status-line">
          <span className="clay-job-spinner" aria-hidden="true" />
          <strong>{status.subject}</strong>
          <span className="crew-status-time">· {status.elapsed}</span>
        </span>
        <span className="crew-status-phase">{status.phase}</span>
      </>
    );
    return status.run.threadId ? (
      <Link
        to="/chat/$thread"
        params={{ thread: status.run.threadId }}
        search={{ run: status.run.id }}
        className="crew-status"
        data-kind="working"
        aria-label={`${name} is working on ${status.subject}: ${status.phase}. Open run`}
      >
        {body}
      </Link>
    ) : (
      <div className="crew-status" data-kind="working">
        {body}
      </div>
    );
  }
  if (status.kind === 'waiting')
    return (
      <Link
        to="/chat/$thread"
        params={{ thread: status.threadId }}
        className="crew-status"
        data-kind="waiting"
      >
        <span className="crew-status-line">
          <span className="clay-bead" data-size="sm" data-tone="ochre" aria-hidden="true" />
          <strong>Needs your answer</strong>
        </span>
        <span className="crew-status-phase">{status.subject}</span>
      </Link>
    );
  if (status.kind === 'idle')
    return (
      <div className="crew-status" data-kind="idle">
        {status.fact}
      </div>
    );
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
      <strong>
        {status.kind === 'paused'
          ? 'Paused'
          : status.kind === 'signin'
            ? 'Needs sign-in'
            : 'Runtime unavailable'}
      </strong>
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
