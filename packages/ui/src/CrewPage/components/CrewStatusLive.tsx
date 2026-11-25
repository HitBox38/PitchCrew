import { Link } from '@tanstack/react-router';
import { Bead } from '@/ClayInterface/components/Bead.tsx';
import { alsoWorking } from '@/CrewPage/helpers.ts';
import type { CrewStatus } from '@/CrewPage/types.ts';

type LiveStatus = Extract<CrewStatus, { kind: 'working' | 'approving' | 'waiting' }>;

/** The other jobs the agent runs meanwhile, under its main line. */
const Also = ({ text }: { text: string }) =>
  text ? <span className="crew-status-also">{text}</span> : null;

/**
 * Live work opens its exact run; a browser request waiting on the user opens its row in Needs you
 * on Home (the lens and this tray approve nothing); a question opens its chat. Each says what else
 * the agent runs meanwhile.
 */
export const CrewStatusLive = ({ status, name }: { status: LiveStatus; name: string }) => {
  const also = alsoWorking(status);
  const spokenAlso = also ? ` ${also}.` : '';
  if (status.kind === 'approving')
    return (
      <Link
        to="/"
        search={{ item: `browser:${status.approvalId}` }}
        className="crew-status"
        data-kind="approving"
        aria-label={`${name} is waiting for your OK on ${status.subject}.${spokenAlso} Open in Needs you`}
      >
        <span className="crew-status-line">
          <Bead tone="ochre" size="sm" />
          <strong>Waiting for your OK</strong>
        </span>
        <span className="crew-status-phase">{status.subject}</span>
        <Also text={also} />
      </Link>
    );
  if (status.kind === 'waiting')
    return (
      <Link
        to="/chat/$thread"
        params={{ thread: status.threadId }}
        className="crew-status"
        data-kind="waiting"
      >
        <span className="crew-status-line">
          <Bead tone="ochre" size="sm" />
          <strong>Waiting for your answer</strong>
        </span>
        <span className="crew-status-phase">{status.subject}</span>
        <Also text={also} />
      </Link>
    );
  const body = (
    <>
      <span className="crew-status-line">
        <span className="clay-job-spinner" aria-hidden="true" />
        <strong>{status.subject}</strong>
        <span className="crew-status-time">· {status.elapsed}</span>
      </span>
      <span className="crew-status-phase">{status.phase}</span>
      <Also text={also} />
    </>
  );
  return status.run.threadId ? (
    <Link
      to="/chat/$thread"
      params={{ thread: status.run.threadId }}
      search={{ run: status.run.id }}
      className="crew-status"
      data-kind="working"
      aria-label={`${name} is working on ${status.subject}: ${status.phase}.${spokenAlso} Open run`}
    >
      {body}
    </Link>
  ) : (
    <div className="crew-status" data-kind="working">
      {body}
    </div>
  );
};
