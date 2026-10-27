import type { ExtractedJob } from '@pitchcrew/core';

export const FormRequirements = ({ form }: { form: ExtractedJob['form'] }) => {
  if (!form || form.status === 'manual')
    return (
      <p className="quiet">
        The application form has not been checked. Required answers, files and formats may still be
        missing.
      </p>
    );
  return (
    <div className="grid gap-2" aria-label="Form requirements for this packet">
      <p className="quiet">
        Inspected page: {form.url}. Review these requirements before drafting.
      </p>
      <ul className="grid gap-2">
        {form.fields.map((field, index) => (
          <li key={index}>
            <strong>{field.label || `Field ${index + 1}`}</strong> · {field.type} ·{' '}
            {field.required ? 'Required' : 'No required flag'}
            {field.accept ? <p>Accepted files: {field.accept}</p> : null}
            {field.maxLength !== undefined ? (
              <p>Maximum length: {field.maxLength} characters</p>
            ) : null}
            {field.options.length ? <p>Choices: {field.options.join(', ')}</p> : null}
            {!field.visible || field.disabled || !field.assessed ? (
              <p className="quiet">
                Hidden, disabled or not fully assessed; requirements may change.
              </p>
            ) : null}
            {field.condition ? <p>Conditional: {field.condition}</p> : null}
            {field.missingAnswer ? <p>Missing: {field.missingAnswer}</p> : null}
          </li>
        ))}
      </ul>
      {form.blockers.map((item, index) => (
        <p className="form-error" key={index}>
          Blocker: {item}
        </p>
      ))}
      {form.uninspected.map((item, index) => (
        <p className="quiet" key={index}>
          Uninspected: {item}
        </p>
      ))}
    </div>
  );
};
