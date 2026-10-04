import type { ArtifactLayout, Packet, PacketArtifact } from '@pitchcrew/core';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { formattedDocx } from './documents/docx.ts';
import { formattedPdf } from './documents/pdf.ts';
import { plainDocx, plainPdf } from './documents/plain.ts';
import { readZip } from './documents/zip.ts';

export const digestBytes = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const resumePageTarget = 1;
export const resumePageWarning = (pages: number) =>
  `The resume runs to ${pages} pages in the formatted layout. The target is one page.`;

const mimeTypes = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

// Formatted layouts read Markdown structure; plain layouts print the Markdown literally. Neither
// executes HTML, fetches URLs or silently drops text, and identical input gives identical bytes.
export async function renderArtifacts(
  packet: Packet,
  formats: ('pdf' | 'docx')[],
  layout: ArtifactLayout = 'formatted',
): Promise<PacketArtifact[]> {
  const output: PacketArtifact[] = [];
  for (const source of ['resume', 'coverLetter'] as const) {
    const text = packet[source];
    let pdf: Promise<{ bytes: Buffer; pages: number }> | undefined;
    const formatted = () => (pdf ??= formattedPdf(text, source));
    for (const format of formats) {
      let bytes: Buffer;
      if (layout === 'plain')
        bytes = format === 'pdf' ? (await plainPdf(text)).bytes : await plainDocx(text);
      else if (format === 'pdf') bytes = (await formatted()).bytes;
      else {
        // The DOCX page estimate comes from the matching PDF layout. Text the PDF font cannot
        // show still exports as DOCX, without an estimate.
        const pages = await formatted().then(
          (rendered) => rendered.pages,
          () => undefined,
        );
        bytes = await formattedDocx(text, source, pages);
      }
      output.push({
        name: `${source === 'resume' ? 'resume' : 'cover_letter'}.${format}`,
        mimeType: mimeTypes[format],
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

async function countPages(artifact: PacketArtifact): Promise<number | null> {
  const bytes = verifiedArtifact(artifact);
  if (artifact.mimeType === mimeTypes.pdf)
    return (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount();
  const app = readZip(bytes).find((entry) => entry.name === 'docProps/app.xml');
  const pages = /<Pages>(\d+)<\/Pages>/.exec(app?.data.toString('utf8') ?? '')?.[1];
  return pages ? Number(pages) : null;
}

const pageCounts = new Map<string, Promise<number | null>>();

// Page counts come from the frozen bytes themselves, so earlier approvals need no stored field.
// PDF counts are exact. DOCX counts are the formatted layout's estimate; Word may differ.
export async function artifactPages(artifacts: PacketArtifact[]): Promise<Record<string, number>> {
  const pages: Record<string, number> = {};
  for (const artifact of artifacts) {
    let count = pageCounts.get(artifact.digest);
    if (!count) {
      count = countPages(artifact).catch(() => null);
      pageCounts.set(artifact.digest, count);
      if (pageCounts.size > 500) pageCounts.delete(pageCounts.keys().next().value!);
    }
    const value = await count;
    if (value !== null) pages[artifact.digest] = value;
  }
  return pages;
}

export interface LayoutReport {
  resumePages: number | null;
  coverLetterPages: number | null;
  warnings: string[];
}

// Renders the formatted PDFs without storing them, so agents can fit the resume to one page.
export async function checkLayout(packet: Packet): Promise<LayoutReport> {
  const warnings: string[] = [];
  const count = (source: 'resume' | 'coverLetter') =>
    formattedPdf(packet[source], source).then(
      (rendered) => rendered.pages,
      (error: unknown) => {
        warnings.push(error instanceof Error ? error.message : String(error));
        return null;
      },
    );
  const resumePages = await count('resume');
  const coverLetterPages = await count('coverLetter');
  if (resumePages !== null && resumePages > resumePageTarget)
    warnings.push(resumePageWarning(resumePages));
  return { resumePages, coverLetterPages, warnings };
}
