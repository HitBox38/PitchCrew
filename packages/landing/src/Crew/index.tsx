import { Pebble } from '../components/clay/Pebble';
import { RoleIcon } from '../components/clay/RoleIcon';
import { extras, supportCrew } from './constants';

export const Crew = () => {
  return (
    <section id="crew" className="section crew" aria-labelledby="crew-title">
      <div className="page-width section-head">
        <h2 id="crew-title" className="headline">
          The rest of the crew waits until you turn it on.
        </h2>
        <p className="section-copy">
          Four more agents ship paused. Any change to their rules is a proposal you approve.
        </p>
      </div>
      <div className="page-width crew-grid">
        <ul className="tray crew-list">
          {supportCrew.map((agent) => (
            <li key={agent.role} className="crew-row" data-role={agent.role}>
              <Pebble agent={agent.role} size={36}>
                <RoleIcon agent={agent.role} size={17} />
              </Pebble>
              <div className="min-w-0">
                <p className="crew-name">{agent.name}</p>
                <p className="crew-text">{agent.text}</p>
              </div>
              <span className="chip crew-state">{agent.state}</span>
            </li>
          ))}
        </ul>
        <dl className="crew-extras">
          {extras.map((extra) => (
            <div key={extra.title} className="crew-extra">
              <dt className="feature-title">{extra.title}</dt>
              <dd className="copy">{extra.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};
