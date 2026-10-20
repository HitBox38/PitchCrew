import { api } from '@/api.ts';
import type { ApplicationImportReport, DatabaseImportConversion } from '@pitchcrew/core';
import type { ImportUpload } from './types.ts';

export const previewImport = ({ format, content }: ImportUpload) => {
  return api<ApplicationImportReport>('/tracking/import/preview', 'POST', { format, content });
};

export const convertDatabaseImport = (content: string) => {
  return api<DatabaseImportConversion>('/tracking/import/database', 'POST', { content });
};
