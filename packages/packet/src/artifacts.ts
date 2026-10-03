import type { Packet, PacketArtifact } from '@pitchcrew/core';
import { createHash } from 'node:crypto';
import { Document, Packer, Paragraph } from 'docx';
import { PDFDocument, StandardFonts } from 'pdf-lib';

export const digestBytes = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// Render literal Markdown as text. Never execute HTML, fetch URLs or silently remove content.
async function pdf(text: string) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  try {
    font.encodeText(text.replace(/[\r\n\t]/g, ' '));
  } catch {
    throw new Error(
      'PDF text contains unsupported characters. Use DOCX or revise the packet; no text was omitted.',
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
  return Buffer.from(await document.save());
}

export async function renderArtifacts(
  packet: Packet,
  formats: ('pdf' | 'docx')[],
): Promise<PacketArtifact[]> {
  const output: PacketArtifact[] = [];
  for (const source of ['resume', 'coverLetter'] as const) {
    for (const format of formats) {
      const bytes =
        format === 'pdf'
          ? await pdf(packet[source])
          : await Packer.toBuffer(
              new Document({
                sections: [
                  {
                    children: packet[source].split(/\r?\n/).map((text) => new Paragraph({ text })),
                  },
                ],
              }),
            );
      output.push({
        name: `${source === 'resume' ? 'resume' : 'cover_letter'}.${format}`,
        mimeType:
          format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        source,
        bytes: bytes.toString('base64'),
        digest: digestBytes(bytes),
      });
    }
  }
  return output;
}

export function verifiedArtifact(artifact: PacketArtifact) {
  const bytes = Buffer.from(artifact.bytes, 'base64');
  if (digestBytes(bytes) !== artifact.digest) throw new Error('Reviewed artifact bytes changed.');
  return bytes;
}
