import { Pebble } from '../components/clay/Pebble';
import { RoleIcon } from '../components/clay/RoleIcon';
import { Posting } from './components/Posting';
import { gates } from './constants';

export const Gates = () => {
  return (
    <section id="gates" className="section gates" aria-labelledby="gates-title">
      <div className="page-width section-head">
        <h2 id="gates-title" className="headline">
          Three gates between a draft and the world.
        </h2>
        <p className="section-copy">
          The checks live in the tools the agents call, not in their instructions.
        </p>
      </div>
      <div className="page-width">
        <ol className="gate-rule" aria-label="Who holds each gate">
          {gates.map((gate) => (
            <li key={gate.title}>
              <Pebble agent={gate.role} size={40} label={`${gate.title}: ${gate.actor}`}>
                <RoleIcon agent={gate.role} size={19} />
              </Pebble>
            </li>
          ))}
        </ol>
        <div className="gate-grid">
          {gates.map((gate) => (
            <article key={gate.title} className="gate" data-role={gate.role}>
              <h3 className="gate-title">{gate.title}</h3>
              <p className="gate-stops">
                <strong>{gate.actor}’s gate.</strong> {gate.stops}
              </p>
              <p className="copy">{gate.text}</p>
            </article>
          ))}
        </div>
        <Posting />
      </div>
    </section>
  );
};
