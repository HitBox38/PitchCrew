import type { JobLookupDuplicate } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { duplicateText } from '../helpers.ts';

/** The fetch result, then any likely duplicates in an ochre note with a way to open them. */
export const LookupNotice = ({
  message,
  duplicates,
  close,
}: {
  message: string;
  duplicates: JobLookupDuplicate[];
  close?: () => void;
}) => {
  const openCard = useWorkspaceStore((state) => state.openCard);
  if (!message && !duplicates.length) return null;
  return (
    <output className="add-job-lookup" aria-live="polite">
      {message ? <p>{message}</p> : null}
      {duplicates.length ? (
        <div className="add-job-duplicates">
          <p className="font-semibold">This job may already be on the board:</p>
          <ul>
            {duplicates.map((card) => (
              <li key={card.id}>
                <span>{duplicateText(card)}</span>
                {close ? (
                  <Button
                    variant="link"
                    size="xs"
                    onClick={() => {
                      close();
                      openCard(card.id);
                    }}
                  >
                    Open
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </output>
  );
};
