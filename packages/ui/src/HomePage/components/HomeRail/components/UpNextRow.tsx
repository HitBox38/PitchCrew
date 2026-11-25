import { Link } from '@tanstack/react-router';
import { Bead } from '@/ClayInterface/components/Bead.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { QueueOrderMenu } from '@/QueuePage/components/QueueOrderMenu.tsx';
import type { QueueMoves } from '@/QueuePage/types.ts';
import type { HomeLinks, UpNextRow as Row } from '../types.ts';

type UpNextRowProps = { row: Row; moves: QueueMoves; links: HomeLinks };

/**
 * One queue waiting for a slot: an empty socket, the job and its next action, then its agent and
 * its place in the line, in one style from first to last ("Scout · 2nd in line"). A queue held
 * behind a brief waits on the user, so it is ochre and leads to that brief in Needs you; others
 * open the job or the conversation. Queue's own order menu moves it.
 */
export const UpNextRow = ({ row, moves, links }: UpNextRowProps) => {
  const body = (
    <>
      <Bead tone={row.itemKey ? 'ochre' : undefined} size="sm" className="home-row-bead" />
      <span className="home-row-title">
        <span className="home-row-subject">{row.subject}</span>{' '}
        <span className="home-row-action">{row.action}</span>
      </span>
      <span className="home-row-detail">
        {row.roleId ? <RoleAvatar agentRole={row.roleId} size="small" /> : null}
        <span className="home-row-says">
          {row.agent ? (
            <>
              <strong>{row.agent}</strong>
              <span className="home-row-sep" aria-hidden="true">
                {' · '}
              </span>
              <span className="sr-only">, </span>
            </>
          ) : null}
          {row.phrase}
        </span>
      </span>
    </>
  );
  const { itemKey, cardId } = row;
  return (
    <li className="home-next">
      {itemKey ? (
        <button type="button" className="home-row" onClick={() => links.show(itemKey)}>
          {body}
        </button>
      ) : cardId ? (
        <button type="button" className="home-row" onClick={() => links.openCard(cardId)}>
          {body}
        </button>
      ) : (
        <Link to="/chat/$thread" params={{ thread: row.threadId }} className="home-row">
          {body}
        </Link>
      )}
      <QueueOrderMenu title={row.subject} moves={moves} />
    </li>
  );
};
