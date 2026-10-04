import { Input } from '@/components/ui/input/components/Input.tsx';
import { maxImportRows } from '../constants.ts';
import type { ImportUpload } from '../types.ts';

export function ImportFileField({
  busy,
  locked,
  upload,
  chooseFile,
}: {
  busy: boolean;
  locked: boolean;
  upload: ImportUpload | null;
  chooseFile: (file: File | undefined) => Promise<void>;
}) {
  return (
    <div className="form flex flex-col gap-2">
      <label>
        Import file
        <Input
          type="file"
          accept=".json,.csv,application/json,text/csv"
          disabled={busy || locked}
          onChange={(event) => void chooseFile(event.target.files?.[0])}
        />
      </label>
      <p className="quiet">
        {upload
          ? `${upload.name} · ${upload.format.toUpperCase()}`
          : `A JSON list or a CSV file with a header row. Up to ${maxImportRows} applications and 2 MB.`}
      </p>
    </div>
  );
}
