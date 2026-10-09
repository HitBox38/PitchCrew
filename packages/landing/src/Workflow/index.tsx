import { ArrowRight } from 'lucide-react';
import { workflow } from './constants';

export function Workflow() {
  return (
    <section id="workflow" className="page-width section-space" aria-labelledby="workflow-title">
      <div className="max-w-2xl">
        <h2 id="workflow-title" className="section-title">
          A little teamwork.
          <br />A lot less starting over.
        </h2>
        <p className="section-copy mt-5">
          Give your crew your background once. They work together on the details, so you can focus
          on the opportunity.
        </p>
      </div>
      <ol className="workflow-grid mt-14">
        {workflow.map(({ name, color, icon: Icon, title, description, output }, index) => (
          <li key={name} className="workflow-step" data-color={color}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="role-icon">
                  <Icon size={23} aria-hidden="true" />
                </span>
                <span className="text-lg font-semibold">{name}</span>
              </div>
              {index < 2 ? (
                <ArrowRight
                  className="handoff-arrow hidden md:block"
                  size={22}
                  aria-hidden="true"
                />
              ) : null}
            </div>
            <h3 className="mt-7 font-serif text-[29px] leading-tight">{title}</h3>
            <p className="mt-4 leading-relaxed text-muted">{description}</p>
            <p className="workflow-output mt-7">{output}</p>
          </li>
        ))}
      </ol>
      <p className="mt-9 text-sm text-muted">
        You choose what to shortlist, review every packet, and approve exports and browser actions.
      </p>
    </section>
  );
}
