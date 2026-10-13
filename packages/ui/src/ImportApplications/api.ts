import { api } from '@/api.ts';
import type { ApplicationImportReport, DatabaseImportConversion } from '@pitchcrew/core';
import type { ImportUpload } from './types.ts';

export function previewImport({ format, content }: ImportUpload) {
  return api<ApplicationImportReport>('/tracking/import/preview', 'POST', { format, content });
}

export function convertDatabaseImport(content: string) {
  return api<DatabaseImportConversion>('/tracking/import/database', 'POST', { content });
}
