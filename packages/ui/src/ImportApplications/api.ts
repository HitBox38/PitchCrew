import { api } from '@/api.ts';
import type { ApplicationImportReport } from '@pitchcrew/core';
import type { ImportUpload } from './types.ts';

export function previewImport({ format, content }: ImportUpload) {
  return api<ApplicationImportReport>('/tracking/import/preview', 'POST', { format, content });
}
