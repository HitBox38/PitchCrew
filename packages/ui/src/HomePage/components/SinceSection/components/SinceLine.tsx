import { Link } from '@tanstack/react-router';
import { Bead } from '@/ClayInterface/components/Bead.tsx';
import type { SinceLine as Line } from '@/lib/since.ts';
import { clockLabel } from '@/lib/time.ts';
import { validatePipelineSearch } from '@/navigation.ts';
import type { HomeLinks } from '../../HomeRail/types.ts';
import { sinceHint } from '../helpers.ts';

type SinceLineProps = { line: Line; links: HomeLinks };

/**
 * One thing recorded since the user was last here: its time, its bead after the bead law (rose for
 * failed work, ochre for a new ask, moss for a positive status), what happened, and where it leads.
 * A line about a job with an item opens that row in Needs you; it never repeats the row's verbs.
 * Work interrupted when Pitchcrew stopped shows no time: nothing recorded when it stopped, and its
 * text names the restart that found it.
 */
export const SinceLine = ({ line, links }: SinceLineProps) => {
  const hint = sinceHint(line.target);
  const body = (
    <>
      {line.kind === 'interrupted' ? (
        <span className="home-since-time" />
      ) : (
        <time className="home-since-time" dateTime={line.at}>
          {clockLabel(line.at)}
        </time>
      )}
      <Bead tone={line.tone} size="sm" className="home-since-bead" />
      <span className="home-since-text">{line.text}</span>
      {hint ? (
        <span className="home-since-hint">
          <span className="sr-only">, </span>
          {hint}
        </span>
      ) : null}
    </>
  );
  const target = line.target;
  let row = <span className="home-since-row">{body}</span>;
  if (target && 'item' in target)
    row = (
      <button type="button" className="home-since-row" onClick={() => links.show(target.item)}>
        {body}
      </button>
    );
  else if (target && 'cardId' in target)
    row = (
      <button
        type="button"
        className="home-since-row"
        onClick={() => links.openCard(target.cardId)}
      >
        {body}
      </button>
    );
  else if (target && 'thread' in target)
    row = (
      <Link
        to="/chat/$thread"
        params={{ thread: target.thread }}
        search={{ run: target.run }}
        className="home-since-row"
      >
        {body}
      </Link>
    );
  else if (target?.to === '/pipeline')
    row = (
      <Link
        to="/pipeline"
        search={validatePipelineSearch(target.search ?? {})}
        className="home-since-row"
      >
        {body}
      </Link>
    );
  return (
    <li className="home-since-line" data-kind={line.kind}>
      {row}
    </li>
  );
};
