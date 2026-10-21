import { keyedItems } from '@/lib/list-keys.ts';
import type { Card } from '@pitchcrew/core';

export const FormAssessments = ({ card }: { card: Card }) => {
  const assessment = card.formAssessments?.at(-1);
  if (!assessment) return null;
  return (
    <section className="my-4 space-y-2">
      <h3>Inspected form requirements</h3>
      <p className="quiet">
        {assessment.page.url} · {new Date(assessment.createdAt).toLocaleString()}
      </p>
      <p className="quiet">
        Requirements describe the inspected page. Conditional behavior and missing answers are agent
        annotations.
      </p>
      {keyedItems(assessment.fields, (field) => JSON.stringify(field)).map(
        ({ item: field, key }) => (
          <div key={key} className="border-b border-border py-3">
            <strong>{field.label || field.selector}</strong> · {field.type} ·{' '}
            {field.required ? 'Required' : 'No required flag'}
            {!field.assessed ? (
              <p className="quiet">Inspected control; answer requirements not yet assessed.</p>
            ) : null}
            {!field.visible ? <p>Hidden at inspection; requirements may change.</p> : null}
            {field.accept ? <p>Accepted files: {field.accept}</p> : null}
            {field.condition ? <p>Conditional: {field.condition}</p> : null}
            {field.missingAnswer ? (
              <p className="form-error">Missing answer: {field.missingAnswer}</p>
            ) : null}
          </div>
        ),
      )}
      {keyedItems(assessment.blockers, (value) => value).map(({ item: blocker, key }) => (
        <p className="form-error" key={key}>
          Blocker: {blocker}
        </p>
      ))}
      {keyedItems(assessment.uninspected, (value) => value).map(({ item: section, key }) => (
        <p className="quiet" key={key}>
          Uninspected: {section}
        </p>
      ))}
    </section>
  );
};
