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
  content: string;
  status: 'new' | 'changed' | 'unchanged' | 'conflict';
}
export interface ProfileSourcePreview {
  token: string;
  source: ProfileSource;
  files: ProfileImportFile[];
  missing: string[];
  expiresAt: string;
}
