export type ProfileSourceInput =
  | { provider: 'github'; repository: string; path: string; ref?: string }
  | { provider: 'drive'; folderId: string };

export interface ImportedProfileFile {
  key: string;
  name: string;
  path: string;
  url: string;
  revision: string;
  digest: string;
}
export interface ProfileSource {
  id: string;
  input: ProfileSourceInput;
  label: string;
  importedAt: string;
  watching?: boolean;
  mode?: 'project';
  revision?: string;
  missingFiles?: string[];
  files: ImportedProfileFile[];
}
export interface ProfileImportFile extends ImportedProfileFile {
  /** Exact saved local text at review time; null for a new local document. */
  before: string | null;
  content: string;
  status: 'new' | 'changed' | 'unchanged' | 'conflict';
}
/** A source document left out of a preview because a Profile note cannot hold it. */
export interface ProfileSkippedFile {
  key: string;
  path: string;
  reason: 'too_large' | 'not_text';
}
export interface ProfileSourcePreview {
  token: string;
  source: ProfileSource;
  files: ProfileImportFile[];
  missing: string[];
  skipped: ProfileSkippedFile[];
  expiresAt: string;
}
