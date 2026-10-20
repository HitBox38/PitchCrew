import type { ApplicationImportReport, CardState } from '@pitchcrew/core';
import { stateLabels } from '../lib/labels.ts';
import { importStatusLabels, maxImportBytes } from './constants.ts';
import type { ImportUpload } from './types.ts';

export const importFormat = (name: string): 'json' | 'csv' | 'sqlite' | null => {
  const extension = name.toLowerCase().split('.').pop();
  if (extension === 'db' || extension === 'sqlite' || extension === 'sqlite3') return 'sqlite';
  return extension === 'json' || extension === 'csv' ? extension : null;
};
export const readImportFile = async (
  file: File,
  convertDatabase: (content: string) => Promise<{ content: string; warnings: string[] }>,
): Promise<ImportUpload> => {
  const format = importFormat(file.name);
  if (!format) throw new Error('Choose a .db, .sqlite, .sqlite3, .json or .csv file.');
  if (file.size > maxImportBytes) throw new Error('Import files can be at most 2 MB.');
  if (format === 'sqlite') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    const converted = await convertDatabase(btoa(binary));
    return { name: file.name, format: 'json', sourceFormat: 'sqlite', ...converted };
  }
  return { name: file.name, format, content: await file.text() };
};
export const importCounts = (report: ApplicationImportReport): string => {
  return (Object.keys(importStatusLabels) as (keyof typeof importStatusLabels)[])
    .filter((status) => report.counts[status])
    .map((status) => `${report.counts[status]} ${importStatusLabels[status].toLowerCase()}`)
    .join(' · ');
};
export const importPath = (path: CardState[]): string => {
  return path.map((state) => stateLabels[state]).join(' → ');
};
