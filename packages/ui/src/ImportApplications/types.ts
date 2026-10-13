export interface ImportUpload {
  name: string;
  format: 'json' | 'csv';
  content: string;
  sourceFormat?: 'sqlite';
  warnings?: string[];
}
