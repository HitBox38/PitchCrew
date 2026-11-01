import { Button } from '@/components/ui/button/components/Button.tsx';
import { FileUp } from 'lucide-react';
import { useRef } from 'react';
import { maxImportRows } from '../constants.ts';
import type { ImportUpload } from '../types.ts';

export const ImportFileField = ({
  busy,
  upload,
  chooseFile,
}: {
  busy: boolean;
  upload: ImportUpload | null;
  chooseFile: (file: File | undefined) => Promise<void>;
}) => {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="import-choose">
      <div className="import-file-picker ui-tray">
        <Button
          variant="outline"
          size="sm"
          aria-describedby="import-file-limits"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <FileUp size={15} aria-hidden="true" /> {upload ? 'Choose another file' : 'Choose file'}
        </Button>
        <span className="import-file-name">
          {upload
            ? `${upload.name} · ${upload.sourceFormat === 'sqlite' ? 'SQLite tracker' : upload.format.toUpperCase()}`
            : 'No file chosen'}
        </span>
        {busy ? <output className="import-file-busy">Reading and checking…</output> : null}
        <input
          ref={input}
          className="sr-only"
          type="file"
          tabIndex={-1}
          aria-label="Choose your tracker or export"
          accept=".db,.sqlite,.sqlite3,.json,.csv,application/json,text/csv,application/vnd.sqlite3"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            void chooseFile(file);
          }}
        />
      </div>
      <p id="import-file-limits" className="import-hint">
        A previous tracker’s .db, .sqlite or .sqlite3 file, or a JSON or CSV export. Up to{' '}
        {maxImportRows.toLocaleString('en-US')} applications and 2 MB. Processed locally; your
        source file stays unchanged.
      </p>
      {upload?.warnings?.length ? (
        <ul className="import-hint list-disc pl-5" aria-label="Database conversion warnings">
          {upload.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
