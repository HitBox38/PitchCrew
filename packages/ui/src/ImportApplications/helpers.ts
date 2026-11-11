import type { CardState, ImportRowStatus } from '@pitchcrew/core';
import { stateLabels } from '../lib/labels.ts';
import { maxImportBytes } from './constants.ts';
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
export const importPath = (path: CardState[]): string => {
  return path.map((state) => stateLabels[state]).join(' → ');
};

export const importButtonLabel = (busy: boolean, ready: number) => {
  if (busy) return ready ? 'Importing…' : 'Preparing preview…';
  if (!ready) return 'Import applications';
  return `Import ${ready} ${ready === 1 ? 'application' : 'applications'}`;
};

/** Chip tone per row outcome: to import primary, imported moss, skipped neutral, invalid rose. */
export const importTones: Record<ImportRowStatus, string | undefined> = {
  new: 'primary',
  created: 'moss',
  imported: undefined,
  duplicate: undefined,
  invalid: 'rose',
  failed: 'rose',
};

const fieldLabels: Record<string, string> = {
  row: 'Row',
  company: 'Company',
  title: 'Title',
  attempt: 'Attempt',
  location: 'Location',
  url: 'Posting link',
  jobIdentifier: 'Job ID',
  state: 'Status',
  submittedAt: 'Submitted date',
  statusAt: 'Status date',
  tags: 'Tags',
  notes: 'Notes',
  weight: 'Weight',
  lessons: 'Lessons',
};

const fieldLabel = (path: string) => {
  const [field = 'row', index, part] = path.split('.');
  if (field === 'history' && index !== undefined)
    return `History entry ${Number(index) + 1}${part === 'at' ? ' date' : part === 'state' ? ' status' : ''}`;
  return fieldLabels[field] ?? field;
};

/** One validator issue ("company: Invalid input: …") as a sentence about the field. */
const issueSentence = (issue: string) => {
  const match = /^([\w.]+): (.*)$/s.exec(issue.trim());
  if (!match) return issue.trim();
  const [, path = 'row', message = ''] = match;
  const field = fieldLabel(path);
  if (/received undefined|^Required|>=1 characters/i.test(message)) return `${field} is missing`;
  const long = /<=(\d+) (characters|items)/.exec(message);
  if (/^Too big/i.test(message) && long)
    return `${field} is too long (at most ${long[1]} ${long[2]})`;
  if (/^Invalid option/i.test(message)) return `${field} isn't one Pitchcrew recognizes`;
  const key = /^Unrecognized keys?: (.*)$/i.exec(message);
  if (key) return `Unknown column ${key[1]}`;
  if (/^Invalid input: expected (\w+)/i.test(message))
    return `${field} has the wrong kind of value`;
  return path === 'row' ? message : `${field}: ${message}`;
};

/**
 * A row's visible reason in plain words. Invalid rows name each field problem and say the row was
 * skipped; the validator's own text stays available as the technical detail.
 */
export const importReason = (row: { row: number; status: ImportRowStatus; reason: string }) => {
  if (row.status !== 'invalid' || !row.reason) return { text: row.reason, detail: null };
  const sentences = row.reason.split('; ').map(issueSentence);
  const text = `${sentences.join('; ').replace(/\.$/, '')} — row ${row.row} was skipped.`;
  return { text, detail: text === row.reason ? null : row.reason };
};

/** The original status and what it becomes here, once when both read the same. */
export const importStatusChange = (row: { sourceState: string; state: CardState | null }) => {
  const imported = row.state ? stateLabels[row.state] : null;
  const source = row.sourceState.trim();
  if (!imported) return source ? `${source} · not imported` : 'No status';
  if (!source || source.toLowerCase().replace(/[_\s-]+/g, ' ') === imported.toLowerCase())
    return imported;
  return `${source} → ${imported}`;
};
