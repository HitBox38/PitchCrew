import { fileURLToPath } from 'node:url';
import type { DocumentFinding } from '@pitchcrew/core';

export const extractDocument = async (
  bytes: Uint8Array,
  mimeType: string,
  headings: string[] = [],
) => {
  if (mimeType !== 'application/pdf') {
    const { extractRawText } = await import('mammoth');
    const { value } = await extractRawText({ buffer: Buffer.from(bytes) });
    return {
      text: value,
      findings: [
        {
          severity: 'warn',
          check: 'layout',
          message:
            'Word controls final DOCX layout. Page counts are estimates; layout is not verified.',
        },
      ] as DocumentFinding[],
    };
  }
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
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
  const task = getDocument(options);
  try {
    const document = await task.promise;
    if (document.numPages > 100)
      throw new Error('Document exceeds the 100-page verification limit.');
    const text: string[] = [];
    const findings: DocumentFinding[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const items = content.items.filter((item) => 'str' in item);
      text.push(items.map((item) => item.str).join(' '));
      try {
        const ys = [
          ...new Set(
            items.filter((item) => item.str.trim()).map((item) => Math.round(item.transform[5])),
          ),
        ].sort((a, b) => b - a);
        if (ys.some((y, i) => i && ys[i - 1] - y > 110))
          findings.push({
            severity: 'warn',
            check: 'layout',
            page: number,
            message: 'Large vertical gap between text lines. Check the page preview.',
          });
        if (
          items.some(
            (item) =>
              item.str.trim() &&
              (item.transform[5] < 15 ||
                item.transform[4] < -2 ||
                item.transform[4] + item.width > page.view[2] + 2),
          )
        )
          findings.push({
            severity: 'warn',
            check: 'layout',
            page: number,
            message: 'Text may extend beyond the page margin. Check the page preview.',
          });
        if (document.numPages > 1 && ys.length && ys[0] - ys.at(-1)! < page.view[3] * 0.35)
          findings.push({
            severity: 'warn',
            check: 'layout',
            page: number,
            message: 'This page has little text. Check page breaks and stranded headings.',
          });
        const rowText = new Map<number, string>();
        for (const item of items)
          if (item.str.trim()) {
            const y = Math.round(item.transform[5]);
            rowText.set(y, (rowText.get(y) ?? '') + item.str);
          }
        const normalize = (value: string) => value.normalize('NFKC').replace(/\s/g, '');
        const lastLine = ys.length ? rowText.get(ys.at(-1)!) : '';
        if (lastLine && headings.some((heading) => normalize(heading) === normalize(lastLine)))
          findings.push({
            severity: 'warn',
            check: 'layout',
            page: number,
            message: 'A heading may be stranded at the bottom of this page. Check the preview.',
          });
        if (
          items.some(
            (item, i) => i && item.str.trim() && item.transform[5] > items[i - 1].transform[5] + 30,
          )
        )
          findings.push({
            severity: 'warn',
            check: 'layout',
            page: number,
            message: 'Extracted reading order may differ from the visual page. Check the preview.',
          });
      } catch {
        findings.push({
          severity: 'warn',
          check: 'layout',
          page: number,
          message:
            'Layout not checked: advisory geometry analysis could not finish. Review the page preview.',
        });
      }
      page.cleanup();
    }
    return { text: text.join('\n'), findings, pages: document.numPages };
  } finally {
    await task.destroy();
  }
};
