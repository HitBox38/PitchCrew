import { Button } from '@pitchcrew/design-system/button';
import { setupWarnings } from '../helpers.ts';
import { reviewSections } from '../review.ts';
import type { StepProps, CreationController } from '../types.ts';

/** Exactly what will be saved, each part with an Edit link back to its step. */
export const ReviewStep = ({ draft, data, goTo }: StepProps & Pick<CreationController, 'goTo'>) => {
  const sections = reviewSections(draft, data);
  const warnings = setupWarnings(draft, data);
  return (
    <div className="agent-wizard-step">
      <dl className="ui-tray agent-wizard-review">
        {sections.map((section, index) => (
          <div key={section.title} className="agent-wizard-review-row">
            <dt>{section.title}</dt>
            <dd>{section.text}</dd>
            <Button
              className="text-button"
              onClick={() => goTo(index)}
              aria-label={`Edit ${section.title.toLowerCase()}`}
            >
              Edit
            </Button>
          </div>
        ))}
      </dl>
      {warnings.length ? (
        <section className="agent-wizard-warnings" aria-labelledby="agent-wizard-warnings">
          <h4 id="agent-wizard-warnings">Before this agent starts work</h4>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="optional">
        It gets only the access listed here. Profile and crew changes need your review; browser
        actions, submissions and exports need your approval.
      </p>
    </div>
  );
};
