import { PDFDocument, StandardFonts } from 'pdf-lib';
import { expect, it, vi } from 'vitest';
import { attachmentText } from '../src/attachment-text.ts';
import { extractDocument } from '../src/verification/extract.ts';

// Exercise both real PDF readers with Windows directory separators on every CI platform.
vi.mock('node:url', async (original) => {
  const actual = await original<typeof import('node:url')>();
  return {
    ...actual,
    fileURLToPath: (url: string | URL) => {
      const path = actual.fileURLToPath(url);
      return String(url).endsWith('/standard_fonts/') ? path.replaceAll('/', '\\') : path;
    },
  };
});

it('verifies and reads PDFs when the standard-font directory uses Windows separators', async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText('Fictional resume with standard fonts.', {
    font: await pdf.embedFont(StandardFonts.Helvetica),
    x: 30,
    y: 100,
  });
  const bytes = await pdf.save();
  await expect(extractDocument(bytes, 'application/pdf')).resolves.toMatchObject({
    text: 'Fictional resume with standard fonts.',
    pages: 1,
  });
  await expect(attachmentText(bytes, 'application/pdf')).resolves.toMatchObject({
    text: expect.stringContaining('Fictional resume with standard fonts.'),
    truncated: false,
  });
});
