import type { ExtractedJob } from '@pitchcrew/core';
import { acceptedFiles, formFindings } from '../helpers.ts';
import { Finding } from './FormFinding.tsx';

type InspectedForm = Extract<NonNullable<ExtractedJob['form']>, { status: 'inspected' }>;

/**
 * The few findings that change what the user prepares: blockers, answers the form needs, files,
 * length limits and what wasn't checked. Every field stays in the list below.
 */
export const FormFindings = ({ form }: { form: InspectedForm }) => {
  const found = formFindings(form);
  const unchecked = form.uninspected.length > 0 || found.uncertain > 0;
  const lists = [form.blockers, found.missing, found.files, found.limits];
  if (!unchecked && lists.every((list) => !list.length)) return null;
  return (
    <dl className="form-findings">
      {form.blockers.length ? (
        <Finding label="Blocked" tone="rose">
          {form.blockers.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </Finding>
      ) : null}
      {found.missing.length ? (
        <Finding label="Needs your answer" tone="ochre" note="Noted by the inspecting agent">
          {found.missing.map(({ field, name, index }) => (
            <li key={index}>
              {name}{' '}
              <span className="quiet">
                · {field.missingAnswer}
                {field.maxLength === undefined
                  ? ''
                  : ` · up to ${field.maxLength.toLocaleString()} characters`}
              </span>
            </li>
          ))}
        </Finding>
      ) : null}
      {found.files.length ? (
        <Finding label="Files">
          {found.files.map(({ field, name, index }) => (
            <li key={index}>
              {name}{' '}
              <span className="quiet">
                · {acceptedFiles(field.accept)}
                {field.required ? ' · required' : ''}
              </span>
            </li>
          ))}
        </Finding>
      ) : null}
      {found.limits.length ? (
        <Finding label="Length limits">
          {found.limits.map(({ field, name, index }) => (
            <li key={index}>
              {name}{' '}
              <span className="quiet">· up to {field.maxLength!.toLocaleString()} characters</span>
            </li>
          ))}
        </Finding>
      ) : null}
      {unchecked ? (
        <Finding label="Not checked">
          {form.uninspected.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
          {found.uncertain ? (
            <li>
              {found.uncertain === 1 ? '1 field' : `${found.uncertain} fields`} hidden, disabled or
              partly checked; requirements may change.
            </li>
          ) : null}
        </Finding>
      ) : null}
    </dl>
  );
};
