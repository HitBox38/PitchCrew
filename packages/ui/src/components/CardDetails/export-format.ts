import type { Card } from '@pitchcrew/core';
import { acceptsFile, sourceFor } from '@/components/InboxView/handoff.ts';

export type ExportFormat = 'pdf' | 'docx' | 'both' | 'markdown';
type Upload = { label: string; accept: string };

const pdf = { name: 'resume.pdf', mimeType: 'application/pdf' } as const;
const docx = {
  name: 'resume.docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

/** The formats the server renders in addition to the Markdown copies it always exports. */
export const exportFormats = (format: ExportFormat) =>
  format === 'markdown' ? [] : format === 'both' ? ['pdf', 'docx'] : [format];

export const exportFormatLabels: Record<ExportFormat, string> = {
  pdf: 'PDF',
  docx: 'Word (.docx)',
  both: 'PDF and Word',
  markdown: 'Markdown only',
};

/**
 * A suggested export format with its reason. It follows the inspected form's resume and cover
 * letter uploads when there are any; otherwise PDF is only a suggestion, never a claim that the
 * employer accepts it.
 */
export const suggestedExportFormat = (card: Card): { format: ExportFormat; reason: string } => {
  const form = card.applicationContext?.form;
  const uploads =
    form?.status === 'inspected'
      ? form.fields.filter(
          (field) =>
            field.type === 'file' && field.visible && !field.disabled && sourceFor(field.label),
        )
      : [];
  if (!uploads.length)
    return {
      format: 'pdf',
      reason:
        form?.status === 'inspected'
          ? 'The inspected form has no resume or cover letter upload. PDF keeps your layout.'
          : 'PDF keeps your layout. Pitchcrew hasn’t checked which files this form accepts.',
    };
  const takesPdf = (field: Upload) => acceptsFile(field.accept, pdf);
  const takesDocx = (field: Upload) => acceptsFile(field.accept, docx);
  const supported = uploads.filter((field) => takesPdf(field) || takesDocx(field));
  const unsupported = uploads.filter((field) => !supported.includes(field));
  const caveat = unsupported.length
    ? ` ${unsupported.map((field) => `${field.label} (${field.accept})`).join(', ')} accepts neither PDF nor Word; check the form.`
    : '';
  const names = supported.map((field) => field.label).join(', ');
  if (!supported.length)
    return { format: 'markdown', reason: `Markdown copies are exported.${caveat}` };
  if (supported.every(takesPdf))
    return { format: 'pdf', reason: `The inspected form accepts PDF for ${names}.${caveat}` };
  if (supported.every(takesDocx))
    return {
      format: 'docx',
      reason: `The inspected form accepts Word for ${names}.${caveat}`,
    };
  return { format: 'both', reason: `The inspected uploads need PDF and Word files.${caveat}` };
};
