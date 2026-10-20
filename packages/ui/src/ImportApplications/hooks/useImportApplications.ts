import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { ApplicationImportReport } from '@pitchcrew/core';
import { useState } from 'react';
import { convertDatabaseImport, previewImport } from '../api.ts';
import { readImportFile } from '../helpers.ts';
import type { ImportUpload } from '../types.ts';

export const useImportApplications = () => {
  const chooseFile = async (file: File | undefined) => {
    setError('');
    setPreview(null);
    setResult(null);
    setUpload(null);
    if (!file) return;
    setBusy(true);
    try {
      const next = await readImportFile(file, convertDatabaseImport);
      setUpload(next);
      setPreview(await previewImport(next));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not read the file.');
    } finally {
      setBusy(false);
    }
  };
  const confirmImport = async () => {
    if (!upload || !preview || busy) return;
    setBusy(true);
    setError('');
    try {
      const report = (await action(
        '/tracking/import/apply',
        'POST',
        { format: upload.format, content: upload.content, digest: preview.digest },
        (value) => `Imported ${(value as ApplicationImportReport).counts.created} applications`,
      )) as ApplicationImportReport;
      setResult(report);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  const action = useWorkspaceStore((state) => state.action);
  const [upload, setUpload] = useState<ImportUpload | null>(null);
  const [preview, setPreview] = useState<ApplicationImportReport | null>(null);
  const [result, setResult] = useState<ApplicationImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const report = result ?? preview;
  const ready = preview?.counts.new ?? 0;
  return { upload, report, result, busy, error, ready, chooseFile, confirmImport };
};
