import type { Packet, PacketArtifact } from '@pitchcrew/core';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { packet } from '../../board/test/fixtures/packet.ts';
import { readZip } from '../src/documents/zip.ts';
import {
  artifactPages,
  checkLayout,
  renderArtifacts,
  resumePageWarning,
  verifiedArtifact,
} from '../src/index.ts';
import legacy from './fixtures/legacy-artifacts.json' with { type: 'json' };

const docxFile = (bytes: Buffer, name: string) =>
  readZip(bytes)
    .find((entry) => entry.name === name)
    ?.data.toString('utf8') ?? '';
const resumePacket = (resume: string): Packet => ({ ...packet, resume });
const noFonts = async () => [];

async function pdfText(bytes: Buffer) {
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    disableFontFace: true,
  });
  const document = await task.promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number++) {
    const content = await (await document.getPage(number)).getTextContent();
    pages.push(
      content.items
        .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
        .join(''),
    );
  }
  await task.destroy();
  return pages.join('\n');
}

async function linkUris(bytes: Buffer) {
  const document = await PDFDocument.load(bytes);
  return document.getPages().flatMap((page) => {
    const annotations = page.node.Annots() ?? PDFArray.withContext(document.context);
    return annotations.asArray().map((reference) => {
      const annotation = document.context.lookup(reference, PDFDict);
      const action = annotation.lookup(PDFName.of('A'), PDFDict);
      const rect = annotation.lookup(PDFName.of('Rect'), PDFArray).asRectangle();
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
      return action.lookup(PDFName.of('URI'), PDFString).asString();
    });
  });
}

const resume = [
  '---',
  'title: Fictional resume',
  '---',
  '\\pagestyle{empty}',
  '# Robin Example',
  '**Platform Engineer**  ',
  '[robin@example.com](mailto:robin@example.com) | <https://example.com/robin>',
  '\\vspace{-8pt}',
  '## Experience',
  '**Northwind Labs** \\hfill 2021--2024',
  '- Built React interfaces.',
  '- Led the [docs site](https://docs.example.com/a(b)) rebuild',
  '1. First',
  '2. Second',
].join('\n');

describe('formatted exports', () => {
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
    expect(docxFile(verifiedArtifact(artifacts[1]), 'word/document.xml')).toContain(
      'Built React interfaces.',
    );
    expect(() => verifiedArtifact({ ...artifacts[0], bytes: 'AA==' })).toThrow('bytes changed');
  });

  it('renders Markdown structure instead of its syntax, with clickable links', async () => {
    const [pdf] = await renderArtifacts(resumePacket(resume), ['pdf']);
    const bytes = verifiedArtifact(pdf);
    const text = await pdfText(bytes);
    for (const word of ['Robin Example', 'Platform Engineer', 'Experience', 'Northwind Labs'])
      expect(text).toContain(word);
    expect(text).toContain('2021\u20132024');
    expect(text).toContain('\u2022');
    expect(text).toMatch(/1\.\s*First/);
    for (const syntax of ['**', '##', '](', 'vspace', 'pagestyle', 'title:', '\\'])
      expect(text).not.toContain(syntax);
    expect(await linkUris(bytes)).toEqual([
      'mailto:robin@example.com',
      'https://example.com/robin',
      'https://docs.example.com/a%28b%29',
    ]);
    const document = await PDFDocument.load(bytes);
    expect(document.getTitle()).toBe('Robin Example');
    expect(document.getCreationDate()?.getTime()).toBe(0);
  });

  it('gives identical bytes for identical input', async () => {
    const first = await renderArtifacts(resumePacket(resume), ['pdf', 'docx']);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await renderArtifacts(resumePacket(resume), ['pdf', 'docx']);
    expect(second.map((artifact) => artifact.digest)).toEqual(
      first.map((artifact) => artifact.digest),
    );
    const plain = await renderArtifacts(packet, ['pdf', 'docx'], 'plain');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await renderArtifacts(packet, ['pdf', 'docx'], 'plain')).map((a) => a.digest)).toEqual(
      plain.map((artifact) => artifact.digest),
    );
  });

  it('embeds a Unicode font and names characters it cannot show', async () => {
    const accented =
      '# Zo\u00eb \u0141\u00f3d\u017a\n\n\u201cQuoted\u201d Caf\u00e9 na\u00efve \u041f\u0440\u0438\u0432\u0435\u0442';
    const [pdf] = await renderArtifacts(resumePacket(accented), ['pdf']);
    const text = await pdfText(verifiedArtifact(pdf));
    for (const word of [
      'Zo\u00eb \u0141\u00f3d\u017a',
      '\u201cQuoted\u201d',
      'Caf\u00e9',
      '\u041f\u0440\u0438\u0432\u0435\u0442',
    ])
      expect(text).toContain(word);
    const unsupported = resumePacket(
      '\u05e9\u05dc\u05d5\u05dd <script>fetch("https://example.com")</script> \u65e5\u672c\u8a9e',
    );
    // Hebrew uses the bundled font; with no CJK font available, the first CJK character stops it.
    await expect(
      renderArtifacts(unsupported, ['pdf'], 'formatted', { fonts: noFonts }),
    ).rejects.toThrow('unsupported characters: "\u65e5" (U+65E5) in the resume');
    await expect(renderArtifacts(resumePacket('\u0142'), ['pdf'], 'plain')).rejects.toThrow(
      'unsupported characters: "\u0142" (U+0142)',
    );
    // DOCX keeps every character, and untrusted markup stays visible text.
    const [docx] = await renderArtifacts(unsupported, ['docx'], 'formatted', { fonts: noFonts });
    const xml = docxFile(verifiedArtifact(docx), 'word/document.xml');
    expect(xml).toContain('\u05e9\u05dc\u05d5\u05dd');
    expect(xml).toContain('\u65e5\u672c\u8a9e');
    // The angle bracket next to Hebrew reads right to left, so it gets its own run.
    expect(xml).toContain('&lt;</w:t>');
    expect(xml).toContain('script&gt;fetch(');
    expect(xml).not.toContain('<script');
    expect(await artifactPages([docx])).toEqual({});
  });

  it('writes Word headings, numbering, hyperlinks and a page estimate', async () => {
    const [docx] = await renderArtifacts(resumePacket(resume), ['docx']);
    const bytes = verifiedArtifact(docx);
    const xml = docxFile(bytes, 'word/document.xml');
    expect(xml).toContain('<w:pStyle w:val="Heading1"/>');
    expect(xml).toContain('<w:pStyle w:val="Heading2"/>');
    expect(xml).toMatch(/<w:numPr><w:ilvl w:val="0"\/><w:numId w:val="\d+"\/><\/w:numPr>/);
    expect(xml).toContain('<w:tab w:val="right"');
    expect(xml).not.toContain('**');
    const links = [...xml.matchAll(/<w:hyperlink [^>]*r:id="([^"]+)"/g)].map((match) => match[1]);
    expect(links).toEqual(['rIdLink1', 'rIdLink2', 'rIdLink3']);
    const relationships = docxFile(bytes, 'word/_rels/document.xml.rels');
    expect(relationships).toContain('Id="rIdLink1"');
    expect(relationships).toContain('Target="mailto:robin@example.com" TargetMode="External"');
    const numbering = docxFile(bytes, 'word/numbering.xml');
    expect(numbering).toContain('<w:numFmt w:val="bullet"/>');
    expect(numbering).toContain('<w:numFmt w:val="decimal"/>');
    expect(docxFile(bytes, 'docProps/app.xml')).toContain('<Pages>1</Pages>');
    expect(docxFile(bytes, 'docProps/core.xml')).toContain('1970-01-01T00:00:00Z');
  });

  it('restarts ordered sequences after bullets and nested parent items', async () => {
    const [docx] = await renderArtifacts(
      resumePacket(
        '1. First\n- Bullet\n1. Restart\n2. Next\n  1. Child\n3. Parent\n  1. Restart child',
      ),
      ['docx'],
    );
    const bytes = verifiedArtifact(docx);
    const xml = docxFile(bytes, 'word/document.xml');
    const ids = [...xml.matchAll(/<w:numId w:val="(\d+)"\/>/g)].map((match) => match[1]);
    expect(ids[0]).not.toBe(ids[2]);
    expect(ids[2]).toBe(ids[3]);
    expect(ids[4]).not.toBe(ids[6]);
  });
  it('counts pages and warns when the resume runs past one page', async () => {
    const long = Array.from(
      { length: 90 },
      (_, index) => `- Fictional achievement number ${index} with enough words to fill a line`,
    ).join('\n');
    const longPacket = resumePacket(`# Robin Example\n\n${long}`);
    const artifacts = await renderArtifacts(longPacket, ['pdf', 'docx']);
    const pages = await artifactPages(artifacts);
    const [pdf, docx] = artifacts;
    expect(pages[pdf.digest]).toBe(2);
    expect(pages[docx.digest]).toBe(2);
    expect(await checkLayout(longPacket)).toEqual({
      resumePages: 2,
      coverLetterPages: 1,
      warnings: [resumePageWarning(2)],
    });
    expect(await checkLayout(packet)).toEqual({
      resumePages: 1,
      coverLetterPages: 1,
      warnings: [],
    });
    const unsupported = await checkLayout(resumePacket('\u65e5'), { fonts: noFonts });
    expect(unsupported.resumePages).toBeNull();
    expect(unsupported.warnings[0]).toContain('U+65E5');
  });

  it('paginates long content without silently discarding the last paragraphs', async () => {
    const lines = Array.from({ length: 200 }, (_, index) => `Full paragraph ${index}`).join('\n\n');
    for (const layout of ['formatted', 'plain'] as const) {
      const [pdf] = await renderArtifacts(resumePacket(lines), ['pdf'], layout);
      const bytes = verifiedArtifact(pdf);
      expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2);
      expect(await pdfText(bytes)).toContain('Full paragraph 199');
    }
    const word = 'x'.repeat(400);
    const [pdf] = await renderArtifacts(resumePacket(word), ['pdf']);
    expect((await pdfText(verifiedArtifact(pdf))).replace(/\s/g, '')).toBe(word);
  });
});

describe('earlier exports', () => {
  const artifacts = legacy as PacketArtifact[];

  it('still verify, count pages and match the plain layout byte for byte', async () => {
    for (const artifact of artifacts) expect(verifiedArtifact(artifact).length).toBeGreaterThan(0);
    const [pdf, docx] = artifacts;
    expect(await artifactPages(artifacts)).toEqual({ [pdf.digest]: 1 });
    const [plain] = await renderArtifacts(packet, ['pdf'], 'plain');
    expect(plain).toEqual(pdf);
    expect(docxFile(verifiedArtifact(docx), 'word/document.xml')).toContain('# Example candidate');
  });
});
