import { Plus } from 'lucide-react';
import { afterApply, supportCrew } from './constants';

export const Crew = () => {
  return (
    <section id="crew" className="crew-section section-space" aria-labelledby="crew-title">
      <div className="page-width">
        <div className="section-head">
          <h2 id="crew-title" className="section-title">
            A crew for every part of the search.
          </h2>
          <p className="section-copy">
            Beyond Scout, Writer and Reviewer, more agents keep the search moving. Each has its own
            instructions, tools and AI model, and starts when you ask or on a routine you set.
          </p>
        </div>
        <div className="crew-layout">
          <div>
            <h3 className="feature-title">The support crew, when you want it.</h3>
            <ul className="support-list">
              {supportCrew.map(({ name, icon: Icon, text }) => (
                <li key={name}>
                  <Icon size={18} aria-hidden="true" />
                  <span>
                    <strong>{name}</strong> {text}
                  </span>
                </li>
              ))}
              <li>
                <Plus size={18} aria-hidden="true" />
                <span>
                  <strong>Your own</strong> agents, with their own purpose, tools, skills and
                  schedule.
                </span>
              </li>
            </ul>
          </div>
          <div className="after-apply">
            <h3 className="feature-title">After you apply, it keeps track.</h3>
            <ul className="after-list">
              {afterApply.map(({ title, text }) => (
                <li key={title}>
                  <strong>{title}</strong> {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
