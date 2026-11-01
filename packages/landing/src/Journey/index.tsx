import { Pebble } from '../components/clay/Pebble';
import { RoleIcon } from '../components/clay/RoleIcon';
import { BoardMini } from './components/BoardMini';
import { BrowserTray } from './components/BrowserTray';
import { ChatTurn } from './components/ChatTurn';
import { JobCard } from './components/JobCard';
import { StageTrack } from './components/StageTrack';
import { steps } from './constants';

const objects = {
  fit: <JobCard />,
  draft: <ChatTurn />,
  submit: <BrowserTray />,
  track: <BoardMini />,
};

export const Journey = () => {
  return (
    <section id="journey" className="section journey" aria-labelledby="journey-title">
      <div className="page-width section-head">
        <h2 id="journey-title" className="headline">
          One job, start to finish.
        </h2>
        <p className="section-copy">
          The track fills as the crew works and stops wherever a decision is yours.
        </p>
      </div>
      <StageTrack />
      <div className="page-width journey-steps">
        {steps.map((step) => (
          <article key={step.id} id={`step-${step.id}`} className="journey-step">
            <div className="journey-copy">
              <h3 className="feature-title journey-title">
                <Pebble agent={step.role} size={32}>
                  <RoleIcon agent={step.role} size={16} />
                </Pebble>
                <span>{step.title}</span>
              </h3>
              <p className="copy">{step.text}</p>
            </div>
            <div className="journey-object">{objects[step.id]}</div>
          </article>
        ))}
      </div>
    </section>
  );
};
