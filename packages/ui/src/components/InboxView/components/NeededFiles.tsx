import { keyedItems } from '@/lib/list-keys.ts';
import type { Approval, Card } from '@pitchcrew/core';
import { neededFiles, type NeededFile } from '../handoff.ts';

const statusText = (file: NeededFile) =>
  file.status === 'covered'
    ? file.files.join(', ')
    : file.status === 'format'
      ? `Accepts ${file.accept}; the chosen export formats don’t match`
      : file.status === 'export'
        ? 'Not in the chosen export formats'
        : 'You provide this';

/** The confirmed form's uploads, checked against the files frozen for this approval. */
export const NeededFiles = ({ approval, card }: { approval: Approval; card: Card }) => {
  const files = neededFiles(card, approval);
  return (
    <section className="mail-handoff-files" aria-label="Files the application asks for">
      <h4>Files the application asks for</h4>
      {files === null ? (
        <p className="quiet">
          {card.applicationContext?.form?.status === 'manual'
            ? 'You chose to check this application form yourself, so confirm which files it asks for.'
            : 'Pitchcrew hasn’t inspected this application form, so confirm which files it asks for.'}
        </p>
      ) : !files.length ? (
        <p className="quiet">The inspected form has no file uploads.</p>
      ) : (
        <ul>
          {keyedItems(files, (file) => file.label).map(({ item: file, key }) => (
            <li key={key} data-status={file.status}>
              <strong>
                {file.label}
                {file.required ? '' : ' (optional)'}
              </strong>
              <span
                className={
                  file.status === 'covered' || (file.status === 'yours' && !file.required)
                    ? undefined
                    : 'text-ochre'
                }
              >
                {statusText(file)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
