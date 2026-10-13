import type { ExtractedJob } from '@pitchcrew/core';

export function BriefSummary({ value }: { value: ExtractedJob }) {
  return (
    <div className="grid gap-2">
      {value.brief.companyContext ? <p className="prewrap">{value.brief.companyContext}</p> : null}
      {(['responsibilities', 'qualifications', 'constraints'] as const).map((field) =>
        value.brief[field].length ? (
          <section key={field}>
            <h4>{field[0].toUpperCase() + field.slice(1)}</h4>
            <ul className="feedback">
              {value.brief[field].map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
      <h4>Application requirements</h4>
      {value.requirements.length ? (
        <ol className="grid list-decimal gap-2 pl-5">
          {value.requirements.map((entry) => (
            <li key={entry.id}>
              <p>
                {entry.question}{' '}
                <span className="quiet">({entry.required ? 'required' : 'optional'})</span>
              </p>
              {entry.personal ? (
                <p className="quiet prewrap">
                  {entry.answer || 'Waiting for your personal answer'}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="quiet">No additional application requirements recorded.</p>
      )}
    </div>
  );
}
