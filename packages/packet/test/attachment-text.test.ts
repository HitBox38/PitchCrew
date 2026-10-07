import { Document, Packer, Paragraph } from 'docx';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { expect, it } from 'vitest';
import { attachmentText } from '../src/attachment-text.ts';
import { readAttachmentText } from '../../orchestrator/src/crew/attachments/text.ts';

it('extracts text from PDF and DOCX in bounded workers without rendering their markup', async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  page.drawText('Fictional PDF resume', {
    x: 30,
    y: 40,
    font: await pdf.embedFont(StandardFonts.Helvetica),
  });
  const word = await Packer.toBuffer(
    new Document({
      sections: [
        {
          children: [
            new Paragraph('Fictional DOCX resume'),
            new Paragraph('<script>plain text</script>'),
          ],
        },
      ],
    }),
  );
  const signal = new AbortController().signal;
  const pdfText = await readAttachmentText(await pdf.save(), 'application/pdf', signal);
  expect(pdfText.text).toContain('Fictional PDF resume');
  expect(pdfText.truncated).toBe(false);
  const wordText = await readAttachmentText(
    word,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    signal,
  );
  expect(wordText.text).toContain('Fictional DOCX resume');
  expect(wordText.text).toContain('<script>plain text</script>');
  expect(wordText.truncated).toBe(false);
});

it('reports unreadable documents and invalid UTF-8 instead of inventing content', async () => {
  await expect(
    readAttachmentText(
      new TextEncoder().encode('not a PDF'),
      'application/pdf',
      new AbortController().signal,
    ),
  ).rejects.toThrow('Could not read');
  await expect(attachmentText(new Uint8Array([0xff]), 'text/plain')).rejects.toThrow();
  const controller = new AbortController();
  controller.abort();
  await expect(
    readAttachmentText(new Uint8Array(), 'text/plain', controller.signal),
  ).rejects.toThrow();
});
