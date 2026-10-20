import { InjectionExample } from './components/InjectionExample';
import { gates } from './constants';

export const Gates = () => {
  return (
    <section id="gates" className="page-width section-space" aria-labelledby="gates-title">
      <div className="section-head">
        <h2 id="gates-title" className="section-title">
          Three checks before anything goes out.
        </h2>
        <p className="section-copy">
          The rules live in the app’s tools, not in a prompt an agent could talk its way around.
        </p>
      </div>
      <ol className="gate-track">
        {gates.map(({ role, actor, icon: Icon, title, text, stops }) => (
          <li key={title} className="gate" data-role={role}>
            <h3 className="gate-title">
              <span className="role-mark" data-role={role}>
                <Icon size={18} aria-hidden="true" />
              </span>
              {title}
            </h3>
            <p className="gate-text">{text}</p>
            <p className="gate-stops">
              <span className="gate-actor">{actor}</span> · {stops}
            </p>
          </li>
        ))}
      </ol>
      <InjectionExample />
    </section>
  );
};
