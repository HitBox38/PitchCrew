import { Button } from '@/components/ui/button/components/Button.tsx';
import { FileUp } from 'lucide-react';
import { useRef } from 'react';
import { maxImportRows } from '../constants.ts';
import type { ImportUpload } from '../types.ts';

export const ImportFileField = ({
  busy,
  locked,
  upload,
  chooseFile,
}: {
  busy: boolean;
  locked: boolean;
  upload: ImportUpload | null;
  chooseFile: (file: File | undefined) => Promise<void>;
}) => {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="form flex flex-col gap-2">
      <span id="import-file-label" className="text-label font-semibold text-ink-soft">
        Choose your tracker or export
      </span>
      <div className="import-file-picker">
        <Button
          className="button"
          aria-describedby="import-file-label"
          disabled={busy || locked}
          onClick={() => input.current?.click()}
        >
          <FileUp size={15} aria-hidden="true" /> {upload ? 'Choose another file' : 'Choose file'}
        </Button>
        <span className="min-w-0 truncate">{upload ? upload.name : 'No file chosen'}</span>
        <input
          ref={input}
          className="sr-only"
          type="file"
          tabIndex={-1}
          aria-label="Choose your tracker or export"
          accept=".db,.sqlite,.sqlite3,.json,.csv,application/json,text/csv,application/vnd.sqlite3"
          disabled={busy || locked}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            void chooseFile(file);
          }}
        />
      </div>
      <p className="quiet">
        {upload
          ? `${upload.sourceFormat === 'sqlite' ? 'SQLite tracker' : upload.format.toUpperCase()} file`
          : `SQLite tracker (.db, .sqlite, .sqlite3), JSON or CSV. Up to ${maxImportRows.toLocaleString('en-US')} applications and 2 MB.`}
      </p>
      {!upload ? (
        <p className="quiet">
          Have an applications.db file from your previous tracker? Choose it directly, with no
          conversion step. For other trackers, use a JSON or CSV export.
        </p>
      ) : null}
      {busy ? (
        <output className="quiet">Reading your file and checking applications…</output>
      ) : null}
      {upload?.warnings?.length ? (
        <ul className="quiet list-disc pl-5" aria-label="Database conversion warnings">
          {upload.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
