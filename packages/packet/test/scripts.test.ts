import fontkit from '@pdf-lib/fontkit';
import type { Packet } from '@pitchcrew/core';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFString,
} from 'pdf-lib';
import { afterAll, describe, expect, it } from 'vitest';
import { packet } from '../../board/test/fixtures/packet.ts';
import { visualOrder } from '../src/documents/bidi.ts';
import { FontChoice, type FontKey } from '../src/documents/font-choice.ts';
import { systemFonts } from '../src/documents/font-search.ts';
import { documentFontkit } from '../src/documents/fontkit.ts';
import { readZip } from '../src/documents/zip.ts';
import { checkLayout, type FontSearch, renderArtifacts, verifiedArtifact } from '../src/index.ts';

// Fictional people and places only. Hebrew reads right to left; `reversed` gives the order its
// letters appear on the page from left to right.
const fixtures = fileURLToPath(new URL('./fixtures/fonts/', import.meta.url));
const collection = join(fixtures, 'NotoSansJP-Subset.ttc');
const openType = join(fixtures, 'NotoSansCJKjp-Subset.otf');
const noFonts: FontSearch = async () => [];
const japaneseFonts: FontSearch = async () => [{ path: collection }];
const reversed = (text: string) => [...text].reverse().join('');
const resumePacket = (resume: string): Packet => ({ ...packet, resume });
const right = 612 - 25.2;

async function renderPdf(markdown: string, fonts: FontSearch = noFonts) {
  const [pdf] = await renderArtifacts(resumePacket(markdown), ['pdf'], 'formatted', { fonts });
  return verifiedArtifact(pdf);
}

async function renderDocx(markdown: string) {
  const [docx] = await renderArtifacts(resumePacket(markdown), ['docx'], 'formatted', {
    fonts: noFonts,
  });
  return (
    readZip(verifiedArtifact(docx))
      .find((entry) => entry.name === 'word/document.xml')
      ?.data.toString('utf8') ?? ''
  );
}

interface Line {
  text: string;
  left: number;
  right: number;
  items: { text: string; x: number; width: number }[];
}

// Text on the first page by line, left to right. PDF.js reports right-to-left items in logical
// order, so they are turned back into the order their glyphs were drawn.
async function visualLines(bytes: Buffer): Promise<Line[]> {
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    disableFontFace: true,
  });
  const document = await task.promise;
  const content = await (await document.getPage(1)).getTextContent();
  await task.destroy();
  const rows = new Map<number, Line['items']>();
  for (const item of content.items) {
    if (!('str' in item) || !item.str) continue;
    const y = Math.round(item.transform[5]);
    const text = item.dir === 'rtl' ? reversed(item.str) : item.str;
    rows.set(y, [...(rows.get(y) ?? []), { text, x: item.transform[4], width: item.width }]);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => {
      items.sort((a, b) => a.x - b.x);
      return {
        text: items.map((item) => item.text).join(''),
        left: items[0].x,
        right: Math.max(...items.map((item) => item.x + item.width)),
        items,
      };
    });
}

async function fontNames(bytes: Buffer) {
  const document = await PDFDocument.load(bytes);
  return document.context
    .enumerateIndirectObjects()
    .flatMap(([, object]) =>
      object instanceof PDFDict && object.get(PDFName.of('Subtype')) === PDFName.of('Type0')
        ? [object.lookup(PDFName.of('BaseFont'), PDFName).decodeText()]
        : [],
    );
}

const keyName = (key: FontKey) => (typeof key === 'string' ? key : key.name);
function fontSegments(choice: FontChoice, text: string, style: 'regular' | 'bold' | 'italic') {
  const segments: [string, string][] = [];
  [...text].forEach((character, index) => {
    const name = keyName(choice.fonts(text, style)[index]);
    const last = segments.at(-1);
    if (last?.[0] === name) last[1] += character;
    else segments.push([name, character]);
  });
  return segments;
}

describe('font fallback', () => {
  it('keeps Latin, digits and punctuation in Liberation Sans and uses bundled fonts for the rest', async () => {
    const choice = await FontChoice.open(() => Promise.reject(new Error('Not searched.')));
    expect(fontSegments(choice, 'שלום, Noa 2024 (תל אביב)', 'regular')).toEqual([
      ['NotoSansHebrew-Regular', 'שלום'],
      ['regular', ', Noa 2024 ('],
      ['NotoSansHebrew-Regular', 'תל'],
      ['regular', ' '],
      ['NotoSansHebrew-Regular', 'אביב'],
      ['regular', ')'],
    ]);
    expect(fontSegments(choice, 'נועה Levi', 'bold')).toEqual([
      ['NotoSansHebrew-Bold', 'נועה'],
      ['bold', ' Levi'],
    ]);
    // Hebrew has no italic face, and vowel points stay with their letter.
    expect(fontSegments(choice, 'ש\u05b8\u05c1לו\u05b9ם', 'italic')).toEqual([
      ['NotoSansHebrew-Regular', 'ש\u05b8\u05c1לו\u05b9ם'],
    ]);
    // The bundled fonts cover these, so the search is never called.
    await choice.cover([{ text: 'שלום עולם', style: 'regular' }], 'resume');
  });

  it('finds CJK fonts through the search and picks the matching weight from a collection', async () => {
    const bytes = await renderPdf(
      '# 山田 花子\n\n東京都の株式会社で開発を担当しました。',
      japaneseFonts,
    );
    expect(await fontNames(bytes)).toEqual([
      'PCREWA+LiberationSans',
      'PCREWB+LiberationSans-Bold',
      'PCRXAA+NotoSansJPSubset-Bold',
      'PCRXAB+NotoSansJPSubset-Regular',
    ]);
    const lines = await visualLines(bytes);
    expect(lines.map((line) => line.text)).toEqual([
      '山田 花子',
      '東京都の株式会社で開発を担当しました。',
    ]);
    expect(lines[1].left).toBeCloseTo(25.2, 1);
  });

  it('breaks Japanese lines between characters but not before closing punctuation', async () => {
    const sentence = '東京都の株式会社で開発を担当しました。「履歴書」、日本語の';
    const bytes = await renderPdf(sentence.repeat(6), japaneseFonts);
    const lines = await visualLines(bytes);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((line) => line.text).join('')).toBe(sentence.repeat(6));
    for (const line of lines) {
      expect(line.text).not.toMatch(/^[、。」]/);
      expect(line.text).not.toMatch(/「$/);
    }
  });

  it('embeds OpenType CFF fonts with valid subsets', async () => {
    const bytes = await renderPdf('ソフトウェアエンジニア 山田花子', async () => [
      { path: openType },
    ]);
    expect((await visualLines(bytes))[0].text).toBe('ソフトウェアエンジニア 山田花子');
    const document = await PDFDocument.load(bytes);
    const programs = document.context
      .enumerateIndirectObjects()
      .flatMap(([, object]) =>
        object instanceof PDFRawStream &&
        object.dict.get(PDFName.of('Subtype')) === PDFName.of('CIDFontType0C')
          ? [Buffer.from(decodePDFRawStream(object).decode())]
          : [],
      );
    expect(programs).toHaveLength(1);
    // The CFF header's offset size must be 1 to 4.
    expect(programs[0][3]).toBe(4);
  });

  it('names a missing character and the kind of font to install', async () => {
    await expect(renderPdf('# Robin\n\n日本語')).rejects.toThrow(
      'PDF text contains unsupported characters: "日" (U+65E5) in the resume. No available font has it. Install a Japanese, Chinese or Korean font',
    );
    await expect(renderPdf(String.fromCodePoint(0x1f600))).rejects.toThrow(
      `"${String.fromCodePoint(0x1f600)}" (U+1F600) in the resume. No available font has it. Copy a font that has it into the fonts folder`,
    );
    const report = await checkLayout(resumePacket('日本語'), { fonts: noFonts });
    expect(report.resumePages).toBeNull();
    expect(report.warnings[0]).toContain('(U+65E5)');
    expect((await checkLayout(resumePacket('日本語'), { fonts: japaneseFonts })).resumePages).toBe(
      1,
    );
  });
});

describe('font subsets', () => {
  const encode = (subset: ReturnType<ReturnType<typeof fontkit.create>['createSubset']>) =>
    new Promise<Buffer>((resolve, reject) => {
      const parts: Uint8Array[] = [];
      subset
        .encodeStream()
        .on('data', (part: Uint8Array) => parts.push(part))
        .on('end', () => resolve(Buffer.concat(parts)))
        .on('error' as 'end', reject);
    });
  // Wraps a bare CFF program in a one-table OpenType file so fontkit can read it back.
  const cffFont = (cff: Buffer) => {
    const header = Buffer.alloc(28);
    header.writeUInt32BE(0x4f54544f, 0);
    header.writeUInt16BE(1, 4);
    header.write('CFF ', 12, 'latin1');
    header.writeUInt32BE(28, 20);
    header.writeUInt32BE(cff.length, 24);
    return Buffer.concat([header, cff]);
  };

  it.each([
    ['a CID-keyed CFF font', openType, undefined],
    ['a TrueType collection with odd-length glyphs', collection, 'NotoSansJPSubset-Regular'],
  ])('keeps glyph outlines intact for %s', async (_, path, face) => {
    const bytes = await readFile(path);
    const original = fontkit.create(bytes, face);
    const kit = documentFontkit();
    const subset = kit.prepare(bytes, face, true).font.createSubset();
    const glyphs = [...'山ソの。花「'].map((character) =>
      original.glyphForCodePoint(character.codePointAt(0)!),
    );
    const ids = glyphs.map((glyph) => subset.includeGlyph(glyph));
    const encoded = await encode(subset);
    const copy = fontkit.create(path.endsWith('.otf') ? cffFont(encoded) : encoded);
    glyphs.forEach((glyph, index) =>
      expect(copy.getGlyph(ids[index]).path.toSVG()).toBe(glyph.path.toSVG()),
    );
  });
});

describe('right-to-left layout', () => {
  it('orders mixed Hebrew and English words, numbers and punctuation', async () => {
    const bytes = await renderPdf(
      [
        'שלום World 2024',
        '',
        'Built React with עברית טובה inside.',
        '',
        'הובלתי צוות של 5 מפתחים (2023).',
        '',
        // A left-to-right mark keeps the plus signs with C.
        `הצגתי ב-C++${String.fromCodePoint(0x200e)} ובפייתון.`,
      ].join('\n'),
    );
    const lines = await visualLines(bytes);
    expect(lines.map((line) => line.text)).toEqual([
      // Rule W7: the digits follow the English word before them, so both read left to right.
      `World 2024 ${reversed('שלום')}`,
      `Built React with ${reversed('עברית טובה')} inside.`,
      `.(2023) ${reversed('מפתחים')} 5 ${reversed('הובלתי צוות של')}`,
      `.${reversed('ובפייתון')} C++-${reversed('הצגתי ב')}`,
    ]);
    // Right-to-left paragraphs align right; left-to-right ones stay left.
    expect(lines[0].right).toBeCloseTo(right, 1);
    expect(lines[1].left).toBeCloseTo(25.2, 1);
    expect(lines[2].right).toBeCloseTo(right, 1);
  });

  it('wraps in logical order and keeps fills, links and bold text working', async () => {
    const words = 'מילה ארוכה בעברית שממשיכה הלאה';
    const bytes = await renderPdf(
      [
        '**חברת אורן** \\hfill 2021–2024',
        '',
        `ראו [אתר](https://example.com/noa) ו**מודגש**. ${Array(6).fill(words).join(' ')}`,
      ].join('\n'),
    );
    const lines = await visualLines(bytes);
    expect(lines[0].text).toMatch(new RegExp(`^2024–2021 *${reversed('חברת אורן')}$`));
    expect(lines[0].left).toBeCloseTo(25.2, 1);
    expect(lines[0].right).toBeCloseTo(right, 1);
    expect(lines.length).toBeGreaterThan(2);
    // The paragraph starts at the right edge of its first line.
    expect(lines[1].text.endsWith(reversed('ראו אתר ומודגש.'))).toBe(true);
    expect(lines.at(-1)!.text.startsWith(reversed('הלאה'))).toBe(true);
    const document = await PDFDocument.load(bytes);
    const [annotation] = (document.getPage(0).node.Annots() as PDFArray).asArray();
    const link = document.context.lookup(annotation, PDFDict);
    const rect = link.lookup(PDFName.of('Rect'), PDFArray).asRectangle();
    const action = link.lookup(PDFName.of('A'), PDFDict);
    expect(action.lookup(PDFName.of('URI'), PDFString).asString()).toBe('https://example.com/noa');
    const word = lines[1].items.find((item) => item.text === reversed('אתר'))!;
    expect(rect.x).toBeCloseTo(word.x, 1);
    expect(rect.width).toBeCloseTo(word.width, 1);
    expect(await fontNames(bytes)).toContain('PCREWF+NotoSansHebrew-Bold');
  });

  it('puts list markers on the right and mirrors nested indents', async () => {
    const bytes = await renderPdf(['- פריט ראשון', '  - פריט מקונן', '1. ראשון'].join('\n'));
    const lines = await visualLines(bytes);
    const marker = (line: Line) => line.items.find((item) => /[•◦]|\d/.test(item.text))!;
    const textRight = (line: Line) =>
      Math.max(
        ...line.items
          .filter((item) => item !== marker(line) && item.text.trim())
          .map((item) => item.x + item.width),
      );
    expect(lines.map((line) => line.text)).toEqual([
      expect.stringMatching(new RegExp(`^${reversed('פריט ראשון')} *•$`)),
      expect.stringMatching(new RegExp(`^${reversed('פריט מקונן')} *◦$`)),
      expect.stringMatching(new RegExp(`^${reversed('ראשון')} *\\.1$`)),
    ]);
    const [first, nested, ordered] = lines;
    const end = (line: Line) => marker(line).x + marker(line).width;
    expect(end(first)).toBeCloseTo(right - 1, 1);
    expect(textRight(first)).toBeCloseTo(right - 10, 1);
    expect(end(nested)).toBeCloseTo(right - 13, 1);
    expect(textRight(nested)).toBeCloseTo(right - 22, 1);
    expect(marker(ordered).x).toBeCloseTo(right - 11, 1);
    expect(textRight(ordered)).toBeCloseTo(right - 14, 1);
  });

  it('places Hebrew points where the font puts them', async () => {
    const bytes = await renderPdf('שָׁלוֹם עוֹלָם');
    const lines = await visualLines(bytes);
    expect(lines[0].text.replace(/\p{M}/gu, '')).toBe(reversed('שלום עולם'));
    const document = await PDFDocument.load(bytes);
    const contents = document.getPage(0).node.Contents()!;
    const streams =
      contents instanceof PDFArray
        ? contents.asArray().map((reference) => document.context.lookup(reference))
        : [contents];
    const operators = streams
      .map((stream) => Buffer.from(decodePDFRawStream(stream as PDFRawStream).decode()))
      .join('');
    // Points with a horizontal offset move inside one text array.
    expect(operators).toMatch(/\[ (<[0-9A-F]{4}> )+-?[\d.]+ <[0-9A-F]{4}> -?[\d.]+ .*\] TJ/);
  });

  it('applies rule L2 to nested levels', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((text, index) => ({
      text,
      level: [0, 1, 2, 2, 1][index],
    }));
    expect(visualOrder(items, (item) => item.level).map((item) => item.text)).toEqual([
      'a',
      'e',
      'c',
      'd',
      'b',
    ]);
  });

  it('stops at scripts that need shaping, even when a font has them', async () => {
    await expect(renderPdf('# ليلى حداد', japaneseFonts)).rejects.toThrow(
      'PDF text contains unsupported characters: "ل" (U+0644) in the resume. Its script joins its letters, which PDF export does not support yet. Use DOCX or revise the packet',
    );
    await expect(renderPdf('नमस्ते')).rejects.toThrow('reorders and combines its letters');
  });
});

describe('formatted documents with other scripts', () => {
  it('give identical bytes for the same text and fonts', async () => {
    const markdown = '# נועה לוי\n\n- דנה כהן\n- 山田 花子\n\n**ソフトウェアエンジニア**';
    const first = await renderArtifacts(resumePacket(markdown), ['pdf', 'docx'], 'formatted', {
      fonts: japaneseFonts,
    });
    const second = await renderArtifacts(resumePacket(markdown), ['pdf', 'docx'], 'formatted', {
      fonts: japaneseFonts,
    });
    expect(second.map((artifact) => artifact.digest)).toEqual(
      first.map((artifact) => artifact.digest),
    );
    expect(await fontNames(verifiedArtifact(first[0]))).toEqual([
      'PCREWA+LiberationSans',
      'PCREWB+LiberationSans-Bold',
      'PCREWF+NotoSansHebrew-Bold',
      'PCREWE+NotoSansHebrew-Regular',
      'PCRXAA+NotoSansJPSubset-Regular',
      'PCRXAB+NotoSansJPSubset-Bold',
    ]);
  });

  it('marks right-to-left paragraphs and runs and East Asian runs in DOCX', async () => {
    const xml = await renderDocx(
      [
        '# נועה לוי',
        '',
        'מהנדסת React בחברת אורן',
        '',
        'ليلى حداد',
        '',
        '山田 花子 ソフト React',
      ].join('\n'),
    );
    const paragraphs = xml.match(/<w:p>.*?<\/w:p>/g)!;
    expect(paragraphs[0]).toContain('<w:bidi/>');
    expect(paragraphs[0]).toMatch(/<w:rtl\/><w:lang w:bidi="he-IL"\/><\/w:rPr><w:t[^>]*>נועה לוי</);
    // English words keep left-to-right runs inside a right-to-left paragraph.
    expect(paragraphs[1]).toContain('<w:bidi/>');
    expect(paragraphs[1]).toContain('<w:r><w:t xml:space="preserve">React</w:t></w:r>');
    expect(paragraphs[1]).toMatch(
      /<w:rtl\/><w:lang w:bidi="he-IL"\/><\/w:rPr><w:t[^>]*> בחברת אורן</,
    );
    expect(paragraphs[2]).toContain('<w:lang w:bidi="ar-SA"/>');
    expect(paragraphs[3]).not.toContain('<w:bidi/>');
    expect(paragraphs[3]).toContain(
      '<w:rFonts w:ascii="Arial" w:cs="Arial" w:eastAsia="Yu Gothic" w:hAnsi="Arial" w:hint="eastAsia"/><w:lang w:eastAsia="ja-JP"/></w:rPr><w:t xml:space="preserve">山田 花子 ソフト </w:t>',
    );
    expect(paragraphs[3]).toContain('<w:r><w:t xml:space="preserve">React</w:t></w:r>');
  });
});

describe('system font search', () => {
  const directories: string[] = [];
  afterAll(async () => {
    for (const directory of directories) {
      expect(directory.startsWith(tmpdir())).toBe(true);
      await rm(directory, { recursive: true, force: true });
    }
  });
  async function folder(...files: string[]) {
    const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-fonts-'));
    directories.push(directory);
    for (const file of files) {
      await mkdir(join(directory, file, '..'), { recursive: true });
      await copyFile(collection, join(directory, file));
    }
    return directory;
  }

  it('lists pointed fonts, data folder fonts, then known system fonts', async () => {
    const home = await folder(
      '.local/share/fonts/noto/NotoSansCJK-Regular.ttc',
      '.local/share/fonts/other/Unrelated.ttf',
    );
    const pointed = await folder('Mine.otf');
    const data = await folder('b.ttf', 'a.ttc', 'notes.txt');
    const search = systemFonts({
      folders: [data],
      env: { PITCHCREW_FONTS: join(pointed, 'Mine.otf') },
      platform: 'linux',
      home,
      root: await folder(),
    });
    expect(await search()).toEqual([
      { path: join(pointed, 'Mine.otf') },
      { path: join(data, 'a.ttc') },
      { path: join(data, 'b.ttf') },
      {
        path: join(home, '.local/share/fonts/noto/NotoSansCJK-Regular.ttc'),
        face: 'NotoSansCJKjp-Regular',
      },
    ]);
  });

  it('matches Windows names without case and macOS names in either Unicode form', async () => {
    const windows = await folder('Fonts/yugothr.TTC');
    expect(
      await systemFonts({ env: { WINDIR: windows }, platform: 'win32', home: windows })(),
    ).toEqual([{ path: join(windows, 'Fonts/yugothr.TTC') }]);
    const mac = await folder('Library/Fonts/ヒラギノ角ゴシック W3.ttc'.normalize('NFD'));
    expect(await systemFonts({ env: {}, platform: 'darwin', home: mac, root: mac })()).toEqual([
      {
        path: join(mac, 'Library/Fonts/ヒラギノ角ゴシック W3.ttc'.normalize('NFD')),
        face: 'HiraginoSans-W3',
      },
    ]);
  });

  it('falls back to every face of a collection when the named face is missing', async () => {
    const home = await folder('.fonts/NotoSansCJK-Regular.ttc');
    const bytes = await renderPdf(
      '**山田** 花子',
      systemFonts({ env: {}, platform: 'linux', home, root: home }),
    );
    expect(await fontNames(bytes)).toEqual([
      'PCREWA+LiberationSans',
      'PCREWB+LiberationSans-Bold',
      'PCRXAA+NotoSansJPSubset-Bold',
      'PCRXAB+NotoSansJPSubset-Regular',
    ]);
  });
});
