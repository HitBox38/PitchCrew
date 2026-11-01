import type { JobSourcePreview } from '@pitchcrew/core';

export const SourcePreview = ({ preview }: { preview: JobSourcePreview }) => {
  return (
    <output className="settings-callout job-source-summary" aria-live="polite">
      <p>
        Found {preview.fetched} postings: {preview.matching} match your filters and{' '}
        {preview.duplicate} of those are already on the board. Testing adds nothing to the board.
        {preview.truncated ? ' This board is large; only the first 2,000 postings are read.' : ''}
      </p>
      {preview.postings.length ? (
        <ul className="grid gap-2" aria-label="Matching postings">
          {preview.postings.map((posting) => (
            <li key={posting.jobId} className="flex flex-wrap items-baseline gap-2">
              <a href={posting.url} target="_blank" rel="noreferrer noopener">
                {posting.title}
              </a>
              <span className="quiet">
                {[posting.location, posting.remote ? 'Remote' : ''].filter(Boolean).join(' · ')}
              </span>
              {posting.onBoard ? <span className="ui-chip">On the board</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="quiet">No postings match these filters right now.</p>
      )}
      {preview.matching > preview.postings.length ? (
        <p className="quiet">Showing the first {preview.postings.length} matches.</p>
      ) : null}
    </output>
  );
};
