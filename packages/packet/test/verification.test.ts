import { describe, it, expect } from 'vitest';
import { packet } from '../../board/test/fixtures/packet.ts';
import {
  prepareVerifiedArtifacts,
  renderArtifacts,
  verifyDocument,
  expectedDocumentText,
  missingContent,
  digestBytes,
} from '../src/index.ts';

describe('document verification', () => {
  it('verifies generated PDF and DOCX independently, using formatted visible content', async () => {
    const result = await prepareVerifiedArtifacts(packet, ['pdf', 'docx']);
    expect(result.reports.map((r) => [r.name, r.status])).toEqual([
      ['resume.pdf', 'verified'],
      ['cover_letter.pdf', 'verified'],
      ['resume.docx', 'verified'],
      ['cover_letter.docx', 'verified'],
    ]);
    expect(result.artifacts).toHaveLength(4);
    expect(result.reports[2].findings.some((f) => f.message.includes('Word'))).toBe(true);
  });
  it('blocks content lost from the generated file and empty or broken files', async () => {
    const [artifact] = await renderArtifacts(packet, ['pdf']);
    const result = await verifyDocument(
      artifact,
      expectedDocumentText(packet.resume + '\nUNIQUE MISSING ENTRY', 'formatted'),
    );
    expect(result.status).toBe('blocked');
    expect(result.findings.some((f) => f.check === 'content')).toBe(true);
    const bytes = Buffer.from('broken');
    expect(
      (
        await verifyDocument(
          { ...artifact, bytes: bytes.toString('base64'), digest: digestBytes(bytes) },
          'Expected',
        )
      ).status,
    ).toBe('blocked');
  });
  it('blocks an empty PDF text layer and validates bytes even after a cached success', async () => {
    const [artifact] = await renderArtifacts(packet, ['pdf']);
    const expected = expectedDocumentText(packet.resume, 'formatted');
    expect((await verifyDocument(artifact, expected)).status).toBe('verified');
    expect(
      (
        await verifyDocument(
          { ...artifact, bytes: Buffer.from('changed bytes').toString('base64') },
          expected,
        )
      ).status,
    ).toBe('blocked');
    const { PDFDocument } = await import('pdf-lib');
    const empty = await PDFDocument.create();
    empty.addPage();
    const bytes = await empty.save();
    const report = await verifyDocument(
      { ...artifact, bytes: Buffer.from(bytes).toString('base64'), digest: digestBytes(bytes) },
      expected,
    );
    expect(report.status).toBe('blocked');
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        check: 'readability',
        message: 'The document has no extractable text.',
      }),
    );
  });
  it('preserves a valid DOCX when PDF cannot render the script', async () => {
    const result = await prepareVerifiedArtifacts({ ...packet, resume: '# مثال\nخبرة مهنية' }, [
      'pdf',
      'docx',
    ]);
    expect(result.reports.find((r) => r.name === 'resume.pdf')?.status).toBe('blocked');
    expect(result.artifacts.some((a) => a.name === 'resume.docx')).toBe(true);
  });
  it('handles bidi visual ordering and composed text without losing repeated content', () => {
    expect(missingContent('שלום café', 'םולש cafe\u0301')).toBe('');
    expect(missingContent('Entry Entry', 'Entry')).not.toBe('');
  });
  it('reports essential timeouts as blocked', async () => {
    const [artifact] = await renderArtifacts(packet, ['pdf']);
    const result = await verifyDocument(artifact, packet.resume, 1);
    expect(result.status).toBe('blocked');
    expect(result.findings[0].message).toContain('timed out');
  });
});
