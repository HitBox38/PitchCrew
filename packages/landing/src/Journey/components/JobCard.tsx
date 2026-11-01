import { Bead } from '../../components/clay/Bead';
import { Pebble } from '../../components/clay/Pebble';
import { stages } from '../constants';

/** The job as a clay board card after Scout has scored it. */
export const JobCard = () => {
  return (
    <div className="job-stage" data-ui="">
      <article className="clay-card job-card" aria-label="Forma, Design Engineer, job card">
        <div className="job-card-top">
          <Pebble size={30}>F</Pebble>
          <span className="job-card-company">Forma</span>
          <span className="fictional">Fictional</span>
        </div>
        <h4 className="job-card-title">Design Engineer</h4>
        <p className="job-card-meta">Berlin · Hybrid · €80k–€100k</p>
        <p className="job-card-tags">
          <span className="chip">Design systems</span>
          <span className="chip">React</span>
          <span className="chip">Accessibility</span>
        </p>
        <div className="job-card-foot">
          <span className="job-card-status">Shortlisted</span>
          <span className="job-card-fit tabular">
            85 <span className="fine">fit</span>
          </span>
        </div>
        <ol className="track job-card-track" aria-label="Stage">
          <span className="track-fill" style={{ '--fill': 1 / 6 } as React.CSSProperties} />
          {stages.map((stage, index) => (
            <li key={stage}>
              <Bead
                size="sm"
                tone={index < 1 ? 'primary' : index === 1 ? 'current' : undefined}
                label={stage}
              />
            </li>
          ))}
        </ol>
      </article>
      <div className="sheet scout-note">
        <p className="review-who">
          <Pebble agent="scout" size={26}>
            S
          </Pebble>
          Scout
        </p>
        <p className="review-text">
          Strong match on accessible React work and documented components. The posting also asks for
          design-system ownership, which your notes do not mention. Worth shortlisting; expect that
          gap in the draft.
        </p>
        <p className="scout-next">
          <Bead tone="ochre" size="sm" />
          Next move: shortlist it and confirm the brief.
        </p>
      </div>
    </div>
  );
};
