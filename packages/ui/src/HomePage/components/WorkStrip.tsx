import { Bead } from '@/ClayInterface/components/Bead.tsx';
import { runTiming } from './HomeRail/helpers.ts';
import type { RailModel } from './HomeRail/types.ts';

type WorkStripProps = { rail: Pick<RailModel, 'working' | 'slots'>; now: number };

/**
 * Where the rail cannot sit beside the desk (under 880px of work width, a phone included), this
 * strip answers "what is my crew doing?" on the first screen: one line per run (the job, the agent
 * and whom a follow-up works for, the time), in the order the slots were taken. It is a glance,
 * not a control. On a phone, which shows no tooltip, each run's step takes a second line, as the
 * rail's rows do; wider, the step is in the tooltip and in Working now below. Its heading pins
 * while the runs scroll away. With nothing running it steps aside; Working now says so.
 */
export const WorkStrip = ({ rail, now }: WorkStripProps) => {
  if (!rail.working.length) return null;
  return (
    <section className="home-strip" aria-labelledby="home-strip-title">
      <div className="home-strip-head">
        <div className="home-strip-bar">
          <h2 id="home-strip-title" className="home-strip-title">
            Working now
          </h2>
          {rail.slots ? (
            <span className="home-strip-fact">
              {rail.slots.active} of {rail.slots.concurrency} slots
            </span>
          ) : null}
        </div>
      </div>
      <ul className="home-strip-runs">
        {rail.working.map((run) => {
          const waiting = !!run.waitingSince;
          const { time, since } = runTiming(run, now);
          return (
            <li
              key={run.runId}
              className="home-strip-run"
              title={`${run.agent}: ${run.activity} · ${since}`}
            >
              <Bead tone={waiting ? 'ochre' : 'plum'} live={!waiting} size="sm" />
              <span className="home-strip-subject">{run.subject}</span>
              <span className="home-strip-agent">
                <span className="sr-only">, </span>
                {run.agent}
              </span>
              <span className="home-strip-time">
                <span className="sr-only">, </span>
                {time}
              </span>
              <span className="home-strip-step">
                <span className="sr-only">, </span>
                {run.activity}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
