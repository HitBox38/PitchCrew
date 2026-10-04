import { Document, Packer, Paragraph } from 'docx';
import { PDFDocument, type PDFFont, StandardFonts } from 'pdf-lib';
import { normalizeDocx } from './docx.ts';

// The original plain text layout: literal Markdown, syntax included, in Helvetica. Its PDF bytes
// match exports made before formatted layouts, so earlier documents can be reproduced exactly.
function unsupported(font: PDFFont, text: string) {
  for (const character of text.replace(/[\r\n\t]/g, ' ')) {
    try {
      font.encodeText(character);
    } catch {
      const code = character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
      return `"${character}" (U+${code})`;
    }
  }
  return undefined;
}

export async function plainPdf(text: string) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  try {
    font.encodeText(text.replace(/[\r\n\t]/g, ' '));
  } catch {
    throw new Error(
      `PDF text contains unsupported characters: ${unsupported(font, text)}. Use DOCX or revise the packet; no text was omitted.`,
    );
  }
  document.setCreationDate(new Date(0));
  document.setModificationDate(new Date(0));
  let page = document.addPage([595, 842]);
  let y = 794;
  for (const paragraph of text.replace(/\r\n/g, '\n').split('\n')) {
    let line = '';
    for (const character of paragraph.replace(/\t/g, '    ')) {
      if (font.widthOfTextAtSize(line + character, 10) > 499) {
        if (y < 48) {
          page = document.addPage([595, 842]);
          y = 794;
        }
        page.drawText(line, { x: 48, y, size: 10, font });
        y -= 15;
        line = '';
      }
      line += character;
    }
    if (y < 48) {
      page = document.addPage([595, 842]);
      y = 794;
    }
    page.drawText(line, { x: 48, y, size: 10, font });
    y -= 15;
  }
  return { bytes: Buffer.from(await document.save()), pages: document.getPageCount() };
}

export async function plainDocx(text: string) {
  const document = new Document({
    sections: [{ children: text.split(/\r?\n/).map((line) => new Paragraph({ text: line })) }],
  });
  return normalizeDocx(await Packer.toBuffer(document));
}
