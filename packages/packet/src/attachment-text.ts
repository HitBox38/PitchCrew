import { chatAttachmentLimits } from '@pitchcrew/core/chat-attachments';
import { fileURLToPath } from 'node:url';

/** Plain text only: never render HTML, follow document links or enable external file access. */
export async function attachmentText(bytes: Uint8Array, mimeType: string) {
  const limit = chatAttachmentLimits.text;
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return { text: value.slice(0, limit), truncated: value.length > limit };
  }
  if (mimeType === 'application/pdf') {
    const pdf = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const options = {
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      useSystemFonts: false,
      useWorkerFetch: false,
      disableFontFace: true,
      useWasm: false,
      enableXfa: false,
      standardFontDataUrl: fileURLToPath(
        new URL('../../standard_fonts/', import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs')),
      ),
    };
    const task = pdf.getDocument(options);
    try {
      const document = await task.promise;
      let text = '';
      for (let number = 1; number <= Math.min(document.numPages, 200); number++) {
        const page = await document.getPage(number);
        const content = await page.getTextContent();
        for (const item of content.items)
          if ('str' in item) {
            text += item.str + (item.hasEOL ? '\n' : ' ');
            if (text.length > limit) return { text: text.slice(0, limit), truncated: true };
          }
        text += '\n';
        page.cleanup();
      }
      return {
        text: text.slice(0, limit),
        truncated: text.length > limit || document.numPages > 200,
      };
    } finally {
      await task.destroy();
    }
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (text.includes('\0')) throw new Error('This file is not UTF-8 text.');
  return { text: text.slice(0, limit), truncated: text.length > limit };
}
