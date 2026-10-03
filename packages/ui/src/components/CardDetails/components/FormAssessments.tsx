import type { Card } from '@pitchcrew/core';

export function FormAssessments({ card }: { card: Card }) {
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
      {assessment.fields.map((field, index) => (
        <div key={index} className="rounded border p-3">
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
      ))}
      {assessment.blockers.map((blocker, index) => (
        <p className="form-error" key={index}>
          Blocker: {blocker}
        </p>
      ))}
      {assessment.uninspected.map((section, index) => (
        <p className="quiet" key={index}>
          Uninspected: {section}
        </p>
      ))}
    </section>
  );
}
