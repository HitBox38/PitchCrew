import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont, type PDFPage, PDFString, rgb } from 'pdf-lib';
import { fontBytes, type FontStyle, fontStyles, styleOf, subsetNames } from './fonts.ts';
import { visibleText } from './inline.ts';
import { parseMarkdown } from './markdown.ts';
import { ascent, descent, linkColor, ruleGray, type Template, templates } from './template.ts';
import type { Block, DocumentKind, Run } from './types.ts';

export interface RenderedDocument {
  bytes: Buffer;
  pages: number;
}
interface Atom {
  kind: 'word' | 'space' | 'break' | 'fill';
  text: string;
  style: FontStyle;
  href?: string;
  width: number;
}

const labels: Record<DocumentKind, string> = { resume: 'resume', coverLetter: 'cover letter' };
const markers = ['\u2022', '\u25e6', '\u25aa', '\u25aa'];
const black = rgb(0, 0, 0);
const blue = rgb(linkColor.red, linkColor.green, linkColor.blue);

// Invisible formatting characters are removed and other spacing becomes a plain space, so the
// font check only rejects characters that would print.
export const cleanText = (text: string) =>
  text
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/[\t\n\v\f\r\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ');

const headingRuns = (runs: Run[]) =>
  runs.map((run) => (run.kind === 'text' ? { ...run, bold: true } : run));
const blockRuns = (block: Block): Run[][] =>
  block.kind === 'heading'
    ? [headingRuns(block.runs)]
    : block.kind === 'paragraph'
      ? [block.runs]
      : block.kind === 'list'
        ? block.items.map((item) => item.runs)
        : [];

// PDF URI actions must be 7-bit ASCII; parentheses and backslashes are escaped as well.
export function asciiUri(href: string) {
  let output = '';
  for (const character of href) {
    const code = character.codePointAt(0)!;
    output +=
      code > 0x20 && code < 0x7f && !'()\\'.includes(character)
        ? character
        : [...new TextEncoder().encode(character)]
            .map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`)
            .join('');
  }
  return output;
}

class PageWriter {
  page!: PDFPage;
  y = 0;
  constructor(
    private document: PDFDocument,
    private template: Template,
    private fonts: Record<FontStyle, PDFFont>,
  ) {
    this.newPage();
  }
  get top() {
    return this.template.page[1] - this.template.margin;
  }
  get right() {
    return this.template.page[0] - this.template.margin;
  }
  newPage() {
    this.page = this.document.addPage(this.template.page);
    this.y = this.top;
  }
  ensure(height: number) {
    if (this.y - height < this.template.margin && this.y !== this.top) this.newPage();
  }
  space(amount: number) {
    if (this.y !== this.top) this.y -= amount;
  }

  atoms(runs: Run[], size: number): Atom[] {
    return runs.flatMap((run): Atom[] => {
      if (run.kind !== 'text')
        return [
          { kind: run.kind, text: '', style: 'regular', width: run.kind === 'fill' ? size : 0 },
        ];
      const style = styleOf(run);
      return cleanText(run.text)
        .split(/( +)/)
        .filter(Boolean)
        .map((text) => ({
          kind: text.startsWith(' ') ? 'space' : 'word',
          text: text.startsWith(' ') ? ' ' : text,
          style,
          href: run.href,
          width: this.fonts[style].widthOfTextAtSize(text.startsWith(' ') ? ' ' : text, size),
        }));
    });
  }

  // Greedy word wrapping; a word wider than the line is split between characters.
  lines(atoms: Atom[], size: number, width: number): Atom[][] {
    const lines: Atom[][] = [];
    let line: Atom[] = [];
    let used = 0;
    let pending: Atom[] = [];
    const finish = () => {
      lines.push(line);
      line = [];
      used = 0;
      pending = [];
    };
    for (const atom of atoms) {
      if (atom.kind === 'break') finish();
      else if (atom.kind === 'space') {
        if (line.length) pending.push(atom);
      } else {
        const gap = pending.reduce((sum, space) => sum + space.width, 0);
        if (line.length && used + gap + atom.width > width) finish();
        let word = atom;
        while (!line.length && word.width > width && [...word.text].length > 1) {
          const characters = [...word.text];
          const font = this.fonts[word.style];
          let count = 1;
          while (
            count < characters.length &&
            font.widthOfTextAtSize(characters.slice(0, count + 1).join(''), size) <= width
          )
            count++;
          const head = characters.slice(0, count).join('');
          const tail = characters.slice(count).join('');
          lines.push([{ ...word, text: head, width: font.widthOfTextAtSize(head, size) }]);
          word = { ...word, text: tail, width: font.widthOfTextAtSize(tail, size) };
        }
        if (line.length) {
          line.push(...pending);
          used += gap;
        }
        line.push(word);
        used += word.width;
        pending = [];
      }
    }
    if (line.length) lines.push(line);
    return lines;
  }

  baseline(size: number, leading: number) {
    this.ensure(leading);
    return this.y - (leading - (ascent + descent) * size) / 2 - ascent * size;
  }

  draw(line: Atom[], x: number, size: number, leading: number, width: number) {
    const baseline = this.baseline(size, leading);
    const used = line.reduce((sum, atom) => sum + atom.width, 0);
    let cursor = x;
    for (let index = 0; index < line.length;) {
      const first = line[index];
      if (first.kind === 'fill') {
        cursor += first.width + Math.max(0, width - used);
        index++;
        continue;
      }
      let end = index;
      let text = '';
      let segment = 0;
      while (
        end < line.length &&
        line[end].kind !== 'fill' &&
        line[end].style === first.style &&
        line[end].href === first.href
      ) {
        text += line[end].text;
        segment += line[end].width;
        end++;
      }
      const font = this.fonts[first.style];
      this.page.drawText(text, {
        x: cursor,
        y: baseline,
        size,
        font,
        color: first.href ? blue : black,
      });
      if (first.href) this.link(first.href, cursor, baseline, segment, size);
      cursor += segment;
      index = end;
    }
    this.y -= leading;
  }

  link(href: string, x: number, baseline: number, width: number, size: number) {
    const context = this.document.context;
    const annotation = context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x, baseline - descent * size, x + width, baseline + ascent * size],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(asciiUri(href)) },
    });
    this.page.node.addAnnot(context.register(annotation));
  }

  rule(y: number, thickness: number) {
    this.page.drawLine({
      start: { x: this.template.margin, y },
      end: { x: this.right, y },
      thickness,
      color: rgb(ruleGray, ruleGray, ruleGray),
    });
  }

  block(block: Block) {
    const { template } = this;
    const left = template.margin;
    const width = this.right - left;
    if (block.kind === 'rule') {
      this.ensure(8);
      this.space(3);
      this.rule(this.y, 0.5);
      this.y -= 5;
    } else if (block.kind === 'heading') {
      const style = template.headings[block.level - 1];
      const lines = this.lines(this.atoms(headingRuns(block.runs), style.size), style.size, width);
      // Keep a heading with the first line that follows it.
      this.ensure(style.before + lines.length * style.leading + style.after + template.leading);
      this.space(style.before);
      for (const line of lines) this.draw(line, left, style.size, style.leading, width);
      if (style.rule) this.rule(this.y - 1, 0.6);
      this.y -= style.after;
    } else if (block.kind === 'paragraph') {
      const lines = this.lines(this.atoms(block.runs, template.size), template.size, width);
      for (const line of lines) this.draw(line, left, template.size, template.leading, width);
      this.y -= template.paragraphAfter;
    } else {
      for (const item of block.items) {
        const markerX = left + item.depth * template.indent;
        const textX = markerX + template.hang + (item.ordered ? 4 : 0);
        const size = template.size;
        const lines = this.lines(this.atoms(item.runs, size), size, this.right - textX);
        // The marker is drawn first so extracted text reads in visual order.
        const marker = item.ordered ? `${item.number}.` : markers[item.depth];
        const markerWidth = this.fonts.regular.widthOfTextAtSize(marker, size);
        const baseline = this.baseline(size, template.leading);
        this.page.drawText(marker, {
          x: item.ordered ? textX - 3 - markerWidth : markerX + 1,
          y: baseline,
          size,
          font: this.fonts.regular,
          color: black,
        });
        if (!lines.length) this.y -= template.leading;
        for (const line of lines)
          this.draw(line, textX, size, template.leading, this.right - textX);
        this.y -= template.itemAfter;
      }
      this.y -= Math.max(0, template.paragraphAfter - template.itemAfter);
    }
  }
}

function usedStyles(blocks: Block[]) {
  const styles = new Set<FontStyle>(['regular']);
  for (const block of blocks)
    for (const runs of blockRuns(block))
      for (const run of runs) if (run.kind === 'text') styles.add(styleOf(run));
  return styles;
}

function checkCharacters(blocks: Block[], fonts: Record<FontStyle, PDFFont>, kind: DocumentKind) {
  const sets = new Map<FontStyle, Set<number>>();
  for (const block of blocks)
    for (const runs of blockRuns(block))
      for (const run of runs) {
        if (run.kind !== 'text') continue;
        const style = styleOf(run);
        if (!sets.has(style)) sets.set(style, new Set(fonts[style].getCharacterSet()));
        for (const character of cleanText(run.text)) {
          const code = character.codePointAt(0)!;
          if (character === ' ' || sets.get(style)!.has(code)) continue;
          throw new Error(
            `PDF text contains unsupported characters: "${character}" (U+${code.toString(16).toUpperCase().padStart(4, '0')}) in the ${labels[kind]}. Use DOCX or revise the packet; no text was omitted.`,
          );
        }
      }
}

export async function formattedPdf(
  markdown: string,
  kind: DocumentKind,
): Promise<RenderedDocument> {
  const blocks = parseMarkdown(markdown);
  const document = await PDFDocument.create({ updateMetadata: false });
  document.registerFontkit(fontkit);
  const fonts = {} as Record<FontStyle, PDFFont>;
  const used = usedStyles(blocks);
  for (const style of fontStyles)
    if (used.has(style))
      fonts[style] = await document.embedFont(await fontBytes(style), {
        subset: true,
        customName: subsetNames[style],
        features: { liga: false },
      });
  checkCharacters(blocks, fonts, kind);
  const writer = new PageWriter(document, templates[kind], fonts);
  for (const block of blocks) writer.block(block);
  const heading = blocks.find((block) => block.kind === 'heading');
  document.setTitle(heading ? visibleText(heading.runs).trim() : labels[kind]);
  document.setCreator('Pitchcrew');
  document.setProducer('Pitchcrew');
  document.setCreationDate(new Date(0));
  document.setModificationDate(new Date(0));
  return { bytes: Buffer.from(await document.save()), pages: document.getPageCount() };
}
