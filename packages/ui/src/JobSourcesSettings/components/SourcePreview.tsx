import { Badge } from '@/components/ui/badge/index.tsx';
import type { JobSourcePreview } from '@pitchcrew/core';

export function SourcePreview({ preview }: { preview: JobSourcePreview }) {
  return (
    <output className="job-source-summary block" aria-live="polite">
      <p>
        Found {preview.fetched} postings: {preview.matching} match your filters and{' '}
        {preview.duplicate} of those are already on the board. Testing adds nothing to the board.
        {preview.truncated ? ' This board is large; only the first 2,000 postings are read.' : ''}
      </p>
      {preview.postings.length ? (
        <ul className="mt-3 grid gap-2" aria-label="Matching postings">
          {preview.postings.map((posting) => (
            <li key={posting.jobId} className="flex flex-wrap items-baseline gap-2">
              <a href={posting.url} target="_blank" rel="noreferrer noopener">
                {posting.title}
              </a>
              <span className="quiet">
                {[posting.location, posting.remote ? 'Remote' : ''].filter(Boolean).join(' · ')}
              </span>
              {posting.onBoard ? <Badge variant="secondary">On the board</Badge> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="quiet mt-2">No postings match these filters right now.</p>
      )}
      {preview.matching > preview.postings.length ? (
        <p className="quiet mt-2">Showing the first {preview.postings.length} matches.</p>
      ) : null}
    </output>
  );
}
