import type { ExtractedJob } from '@pitchcrew/core';
import { timeAgo } from '@/lib/time.ts';
import { formFindings, pageName } from '../helpers.ts';
import { FormFindings } from './FormFindings.tsx';
import { FormFieldList } from './FormFieldList.tsx';

/**
 * An inspected form reads as one summary line, the findings that change what the user prepares,
 * then every field on request. A manual choice is stated once, by the form section.
 */
export const FormRequirements = ({
  form,
  checkedAt,
  selectors,
  reviewing,
}: {
  form: ExtractedJob['form'];
  checkedAt?: string;
  selectors?: string[];
  reviewing: boolean;
}) => {
  if (form?.status === 'manual') return null;
  if (!form)
    return (
      <p className="quiet">
        Not checked yet. Required answers, files and formats may still be missing.
      </p>
    );
  const { required } = formFindings(form);
  const count = form.fields.length;
  return (
    <div className="grid gap-3" aria-label="Form requirements for this packet">
      <p className="quiet">
        {count
          ? `${count} ${count === 1 ? 'field' : 'fields'}, ${required} required`
          : 'No form fields captured'}{' '}
        · {pageName(form.url)}
        {checkedAt ? (
          <>
            {' · '}
            <time dateTime={checkedAt} title={new Date(checkedAt).toLocaleString()}>
              {timeAgo(checkedAt)}
            </time>
          </>
        ) : null}
      </p>
      {count === 0 ? (
        <p className="quiet">
          Use Add requirement in the brief editor for questions you verified on the form. Select
          Needs my personal answer for questions that require your input.
        </p>
      ) : null}
      <FormFindings form={form} />
      <FormFieldList
        key={String(reviewing)}
        fields={form.fields}
        selectors={selectors?.length === form.fields.length ? selectors : undefined}
        defaultOpen={reviewing}
      />
    </div>
  );
};
