import type { ApplicationImportReport, CardState } from '@pitchcrew/core';
import { stateLabels } from '../lib/labels.ts';
import { importStatusLabels, maxImportBytes } from './constants.ts';
import type { ImportUpload } from './types.ts';

export function importFormat(name: string): 'json' | 'csv' | null {
  const extension = name.toLowerCase().split('.').pop();
  return extension === 'json' || extension === 'csv' ? extension : null;
}
export async function readImportFile(file: File): Promise<ImportUpload> {
  const format = importFormat(file.name);
  if (!format) throw new Error('Choose a .json or .csv file.');
  if (file.size > maxImportBytes) throw new Error('Import files can be at most 2 MB.');
  return { name: file.name, format, content: await file.text() };
}
export function importCounts(report: ApplicationImportReport): string {
  return (Object.keys(importStatusLabels) as (keyof typeof importStatusLabels)[])
    .filter((status) => report.counts[status])
    .map((status) => `${report.counts[status]} ${importStatusLabels[status].toLowerCase()}`)
    .join(' · ');
}
export function importPath(path: CardState[]): string {
  return path.map((state) => stateLabels[state]).join(' → ');
}
