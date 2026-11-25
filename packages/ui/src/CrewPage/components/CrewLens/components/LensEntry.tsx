import { useId } from 'react';
import { Bead } from '@/ClayInterface/components/Bead.tsx';
import type { LensEntry as Entry } from '@/lib/crew-lens.ts';
import { entryAction, entryLabel, keepSeparators, stampTone } from '../helpers.ts';
import { LensControl } from './LensControl.tsx';
import { LensLink } from './LensLink.tsx';
import { LensStamp } from './LensStamp.tsx';

/**
 * One job-owned piece of an agent's work on a recessed line: the bead, then the job, what it does
 * (or "Crew follow-up for Reviewer") and its stamp on line one, its live step, wait or reason on
 * line two. A wait on the user sits on an ochre wash. The whole line opens its place; a running job
 * queue's menu sits at the end.
 */
export const LensEntry = ({ entry, agent }: { entry: Entry; agent: string }) => {
  const detail = useId();
  const action = entryAction(entry);
  return (
    <li className="crew-lens-entry" data-state={entry.state}>
      <Bead tone={entry.tone} live={entry.live} size="sm" className="crew-lens-bead" />
      <LensLink
        entry={entry}
        className="crew-lens-open"
        label={entryLabel(agent, entry)}
        describedBy={detail}
        stop
      >
        <span className="crew-lens-line">
          <strong className="crew-lens-subject">{entry.subject}</strong>
          {entry.followUpFor ? (
            <span className="ui-chip crew-lens-chip">Crew follow-up</span>
          ) : null}
          {action ? <span className="crew-lens-action">{action}</span> : null}
        </span>
        <LensStamp stamp={entry.stamp} tone={stampTone(entry)} />
        <span className="crew-lens-detail" id={detail}>
          {action ? <span className="crew-lens-detail-action">{`${action} · `}</span> : null}
          {keepSeparators(entry.detail)}
        </span>
      </LensLink>
      <span className="crew-lens-control">
        <LensControl entry={entry} />
      </span>
    </li>
  );
};
