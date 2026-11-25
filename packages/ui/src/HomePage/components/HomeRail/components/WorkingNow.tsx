import { Bead } from '@/ClayInterface/components/Bead.tsx';
import { idleLine, slotNotes, slotsInUse } from '../helpers.ts';
import type { HomeLinks, RailModel } from '../types.ts';
import { RailRun } from './RailRun.tsx';

type WorkingNowProps = { rail: RailModel; now: number; links: HomeLinks };

/**
 * What holds the work slots: one row per executing run, in the order the slots were taken, then a
 * line for every other slot in use (a deep review's reservation, background routines, work just
 * starting), so the slot count is never left unexplained. Slots and runs are counted apart.
 */
export const WorkingNow = ({ rail, now, links }: WorkingNowProps) => {
  const notes = slotNotes(rail);
  return (
    <div className="home-block home-working">
      <header className="home-block-head" data-fact={rail.slots ? '' : undefined}>
        <h2 className="home-heading">Working now</h2>
        {rail.slots ? <span className="home-block-fact">{slotsInUse(rail.slots)}</span> : null}
      </header>
      {rail.working.length || notes.length ? (
        <ul className="home-rows">
          {rail.working.map((run) => (
            <RailRun key={run.runId} run={run} now={now} links={links} />
          ))}
          {notes.map((note) => (
            <li key={note} className="home-note">
              <Bead size="sm" className="home-row-bead" />
              {note}
            </li>
          ))}
        </ul>
      ) : (
        <p className="home-empty">
          <Bead size="sm" />
          {idleLine(rail.slots?.concurrency ?? 0)}
        </p>
      )}
    </div>
  );
};
