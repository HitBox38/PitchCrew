import type { JobLookupDuplicate } from '@pitchcrew/core';
import { duplicateText } from '../helpers.ts';

export function LookupNotice({
  message,
  duplicates,
}: {
  message: string;
  duplicates: JobLookupDuplicate[];
}) {
  if (!message && !duplicates.length) return null;
  return (
    <output className="quiet block font-normal" aria-live="polite">
      {message ? <p>{message}</p> : null}
      {duplicates.length ? (
        <>
          <p className="font-semibold">This job may already be on the board:</p>
          <ul className="list-disc pl-5">
            {duplicates.map((card) => (
              <li key={card.id}>{duplicateText(card)}</li>
            ))}
          </ul>
        </>
      ) : null}
    </output>
  );
}
