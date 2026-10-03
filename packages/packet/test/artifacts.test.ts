import { PDFDocument } from 'pdf-lib';
import { inflateRawSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { packet } from '../../board/test/fixtures/packet.ts';
import { renderArtifacts, verifiedArtifact } from '../src/index.ts';

function documentXml(bytes: Buffer) {
  for (let offset = 0; offset + 30 < bytes.length; offset++) {
    if (bytes.readUInt32LE(offset) !== 0x04034b50) continue;
    const length = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 30, offset + 30 + nameLength).toString();
    const start = offset + 30 + nameLength + extraLength;
    if (name === 'word/document.xml')
      return inflateRawSync(bytes.subarray(start, start + length)).toString();
  }
  throw new Error('DOCX document.xml missing');
}

it('produces parseable PDF/DOCX documents and freezes their binary manifests', async () => {
  const artifacts = await renderArtifacts(packet, ['pdf', 'docx']);
  expect(artifacts.map((artifact) => artifact.name)).toEqual([
    'resume.pdf',
    'resume.docx',
    'cover_letter.pdf',
    'cover_letter.docx',
  ]);
  const pdf = await PDFDocument.load(verifiedArtifact(artifacts[0]));
  expect(pdf.getPageCount()).toBe(1);
  expect(documentXml(verifiedArtifact(artifacts[1]))).toContain('Built React interfaces.');
  expect(() => verifiedArtifact({ ...artifacts[0], bytes: 'AA==' })).toThrow('bytes changed');
});

it('preserves Unicode and untrusted literal markup in DOCX, explicitly fails unsupported PDF glyphs', async () => {
  const resume = 'שלום <script>fetch("https://example.com")</script> 日本語';
  const artifacts = await renderArtifacts({ ...packet, resume }, ['docx']);
  const xml = documentXml(verifiedArtifact(artifacts[0]));
  expect(xml).toContain('שלום');
  expect(xml).toContain('日本語');
  expect(xml).toContain('&lt;script&gt;');
  await expect(renderArtifacts({ ...packet, resume }, ['pdf'])).rejects.toThrow(
    'unsupported characters',
  );
});

it('paginates long content without silently discarding the last paragraphs', async () => {
  const artifacts = await renderArtifacts(
    {
      ...packet,
      resume: Array.from({ length: 200 }, (_, index) => `Full paragraph ${index}`).join('\n'),
    },
    ['pdf'],
  );
  const pdf = await PDFDocument.load(verifiedArtifact(artifacts[0]));
  expect(pdf.getPageCount()).toBeGreaterThan(3);
});
