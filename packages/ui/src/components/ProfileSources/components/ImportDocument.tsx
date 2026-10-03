import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import type { ProfileImportFile } from '@pitchcrew/core';
import { importStatus } from '../helpers.ts';

export function ImportDocument({
  file,
  selected,
  toggle,
  busy,
}: {
  file: ProfileImportFile;
  selected: boolean;
  toggle: (name: string) => void;
  busy: boolean;
}) {
  return (
    <div className={`profile-import-document ${file.status === 'conflict' ? 'conflict' : ''}`}>
      <label className="profile-import-choice" aria-label={`Import ${file.path}`}>
        <Checkbox checked={selected} onCheckedChange={() => toggle(file.name)} disabled={busy} />
        <span>
          <strong>{file.path}</strong>
          <small>{importStatus[file.status]}</small>
        </span>
      </label>
      <details>
        <summary>Read document</summary>
        <pre>{file.content}</pre>
        <a href={file.url} target="_blank" rel="noreferrer">
          Open original source
        </a>
      </details>
      <span className="sr-only">Saved as {file.name}</span>
    </div>
  );
}
