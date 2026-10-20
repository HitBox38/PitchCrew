import { Input } from '@/components/ui/input/components/Input.tsx';
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
  return (
    <div className="form flex flex-col gap-2">
      <label>
        Choose your tracker or export
        <Input
          type="file"
          accept=".db,.sqlite,.sqlite3,.json,.csv,application/json,text/csv,application/vnd.sqlite3"
          disabled={busy || locked}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            void chooseFile(file);
          }}
        />
      </label>
      <p className="quiet">
        {upload
          ? `${upload.name} · ${upload.sourceFormat === 'sqlite' ? 'SQLite tracker' : upload.format.toUpperCase()}`
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
