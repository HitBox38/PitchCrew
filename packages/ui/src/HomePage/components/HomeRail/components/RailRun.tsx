import { Link } from '@tanstack/react-router';
import { Bead } from '@/ClayInterface/components/Bead.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { runTiming } from '../helpers.ts';
import type { HomeLinks, RailRun as Run } from '../types.ts';

type RailRunProps = { run: Run; now: number; links: HomeLinks };

/**
 * One run in a work slot, two lines: the bead, the job and what it does, and the time; then the
 * agent and its latest step (clamped, whole in the tooltip). Plum breathes while the agent works;
 * a run waiting on a browser approval is still ochre and leads to that row in Needs you. Others
 * open the job, or the conversation that holds the run.
 */
export const RailRun = ({ run, now, links }: RailRunProps) => {
  const { time, since } = runTiming(run, now);
  const waiting = !!run.waitingSince;
  const body = (
    <>
      <Bead tone={waiting ? 'ochre' : 'plum'} live={!waiting} size="sm" className="home-row-bead" />
      <span className="home-row-title">
        <span className="home-row-subject">{run.subject}</span>{' '}
        <span className="home-row-action">{run.action}</span>
      </span>
      <span className="home-row-meta" title={since}>
        <span className="sr-only">, </span>
        {time}
      </span>
      <span className="home-row-detail" title={`${run.agent}: ${run.activity}`}>
        <RoleAvatar agentRole={run.roleId} size="small" />
        <span className="home-row-says">
          <strong>{run.agent}</strong>
          <span className="home-row-sep" aria-hidden="true">
            {' · '}
          </span>
          <span className="sr-only">, </span>
          {run.activity}
        </span>
      </span>
    </>
  );
  const { itemKey, cardId } = run;
  return (
    <li className="home-run">
      {itemKey ? (
        <button type="button" className="home-row" onClick={() => links.show(itemKey)}>
          {body}
        </button>
      ) : cardId ? (
        <button type="button" className="home-row" onClick={() => links.openCard(cardId)}>
          {body}
        </button>
      ) : (
        <Link
          to="/chat/$thread"
          params={{ thread: run.threadId }}
          search={{ run: run.runId }}
          className="home-row"
        >
          {body}
        </Link>
      )}
    </li>
  );
};
