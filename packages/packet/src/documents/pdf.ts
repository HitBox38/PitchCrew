import {
  beginText,
  endText,
  type PDFFont,
  PDFDocument,
  PDFHexString,
  PDFOperator,
  PDFOperatorNames,
  type PDFPage,
  PDFString,
  popGraphicsState,
  pushGraphicsState,
  type RGB,
  rgb,
  setFillingColor,
  setFontAndSize,
  setTextMatrix,
} from 'pdf-lib';
import type { Direction } from './bidi.ts';
import { FontChoice } from './font-choice.ts';
import { type FontSearch, systemFonts } from './font-search.ts';
import { rtlMark } from './fontkit.ts';
import { type FontStyle, styleOf } from './fonts.ts';
import { visibleText } from './inline.ts';
import {
  type Atom,
  cleanText,
  type Fonts,
  type Piece,
  paragraph,
  visualChunks,
  wrap,
} from './lines.ts';
import { parseMarkdown } from './markdown.ts';
import { ascent, descent, linkColor, ruleGray, type Template, templates } from './template.ts';
import type { Block, DocumentKind, ListItem, Run } from './types.ts';

export interface RenderedDocument {
  bytes: Buffer;
  pages: number;
}

const labels: Record<DocumentKind, string> = { resume: 'resume', coverLetter: 'cover letter' };
const markers = ['\u2022', '\u25e6', '\u25aa', '\u25aa'];
const black = rgb(0, 0, 0);
const blue = rgb(linkColor.red, linkColor.green, linkColor.blue);

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
const marker = (item: ListItem) => (item.ordered ? `${item.number}.` : markers[item.depth]);

// Every text the writer draws, with its style, so fonts are chosen before layout.
function documentTexts(blocks: Block[]) {
  const texts: { text: string; style: FontStyle }[] = [];
  for (const block of blocks) {
    for (const runs of blockRuns(block))
      for (const run of runs)
        if (run.kind === 'text') texts.push({ text: cleanText(run.text), style: styleOf(run) });
    if (block.kind === 'list')
      for (const item of block.items) texts.push({ text: marker(item), style: 'regular' });
  }
  return texts;
}

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
    private fonts: Fonts,
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

  baseline(size: number, leading: number) {
    this.ensure(leading);
    return this.y - (leading - (ascent + descent) * size) / 2 - ascent * size;
  }

  // Draws pieces in visual order. Neighbours with the same font, link and direction share one text
  // operation; right-to-left groups go to fontkit in logical order behind the right-to-left mark.
  pieces(pieces: Piece[], x: number, baseline: number, size: number) {
    let cursor = x;
    for (let index = 0; index < pieces.length;) {
      const first = pieces[index];
      let end = index;
      let width = 0;
      while (
        end < pieces.length &&
        pieces[end].font === first.font &&
        pieces[end].href === first.href &&
        pieces[end].level % 2 === first.level % 2
      ) {
        width += pieces[end].width;
        end++;
      }
      const group = pieces.slice(index, end);
      const text =
        first.level % 2
          ? rtlMark +
            group
              .reverse()
              .map((piece) => piece.text)
              .join('')
          : group.map((piece) => piece.text).join('');
      this.text(text, first.font, cursor, baseline, size, first.href ? blue : black);
      if (first.href) this.link(first.href, cursor, baseline, width, size);
      cursor += width;
      index = end;
    }
  }

  // pdf-lib advances glyph by glyph and ignores the offsets fontkit gives marks, such as Hebrew
  // points. Fallback text with such offsets is shown as one text
  // array in which each mark moves by its horizontal offset and back. Advances stay the font's own
  // widths, as measured for wrapping. Vertical offsets are left out: a text rise would split the
  // word for PDF readers that extract text.
  text(text: string, font: PDFFont, x: number, y: number, size: number, color: RGB) {
    const shaped = this.fonts.shaped.get(font);
    const run = shaped?.layout(text, { liga: false } as never);
    if (!shaped || !run || run.positions.every((position) => !position.xOffset)) {
      this.page.drawText(text, { x, y, size, font, color });
      return;
    }
    const codes = font.encodeText(text).asString().match(/.{4}/g) ?? [];
    const shown = run.positions.flatMap((position, index) => {
      // Text arrays count in thousandths of the font size; positive numbers move left.
      const shift = (position.xOffset * 1000) / shaped.unitsPerEm;
      const glyph = PDFHexString.of(codes[index]);
      return shift ? [-shift, glyph, shift] : [glyph];
    });
    this.page.pushOperators(
      pushGraphicsState(),
      beginText(),
      setFillingColor(color),
      setFontAndSize(this.page.node.newFontDictionary(font.name, font.ref), size),
      setTextMatrix(1, 0, 0, 1, x, y),
      PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [this.document.context.obj(shown)]),
      endText(),
      popGraphicsState(),
    );
  }

  // Left-to-right lines start at `x`; right-to-left lines end at `x + width`. A fill takes the
  // space the line leaves, so the text after it reaches the far edge.
  draw(
    line: Atom[],
    x: number,
    size: number,
    leading: number,
    width: number,
    direction: Direction,
  ) {
    const baseline = this.baseline(size, leading);
    const extra = Math.max(0, width - line.reduce((sum, atom) => sum + atom.width, 0));
    let offset = 0;
    for (const chunk of visualChunks(line, direction)) {
      const start = direction === 'rtl' ? x + width - offset - chunk.width : x + offset;
      this.pieces(chunk.pieces, start, baseline, size);
      offset += chunk.width + (chunk.fill === undefined ? 0 : chunk.fill + extra);
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
      const text = paragraph(headingRuns(block.runs), style.size, this.fonts);
      const lines = wrap(text.atoms, style.size, width);
      // Keep a heading with the first line that follows it.
      this.ensure(style.before + lines.length * style.leading + style.after + template.leading);
      this.space(style.before);
      for (const line of lines)
        this.draw(line, left, style.size, style.leading, width, text.direction);
      if (style.rule) this.rule(this.y - 1, 0.6);
      this.y -= style.after;
    } else if (block.kind === 'paragraph') {
      const text = paragraph(block.runs, template.size, this.fonts);
      for (const line of wrap(text.atoms, template.size, width))
        this.draw(line, left, template.size, template.leading, width, text.direction);
      this.y -= template.paragraphAfter;
    } else {
      for (const item of block.items) this.item(item);
      this.y -= Math.max(0, template.paragraphAfter - template.itemAfter);
    }
  }

  // Right-to-left items mirror the hanging indent: the marker sits at the right edge.
  item(item: ListItem) {
    const { template } = this;
    const size = template.size;
    const left = template.margin;
    const text = paragraph(item.runs, size, this.fonts);
    const rtl = text.direction === 'rtl';
    const indent = item.depth * template.indent;
    const textIndent = indent + template.hang + (item.ordered ? 4 : 0);
    const textWidth = this.right - left - textIndent;
    const lines = wrap(text.atoms, size, textWidth);
    const label = paragraph(
      [{ kind: 'text', text: marker(item), bold: false, italic: false }],
      size,
      this.fonts,
      text.direction,
    ).atoms;
    const labelWidth = label.reduce((sum, atom) => sum + atom.width, 0);
    const markerX = rtl
      ? item.ordered
        ? this.right - textIndent + 3
        : this.right - indent - 1 - labelWidth
      : item.ordered
        ? left + textIndent - 3 - labelWidth
        : left + indent + 1;
    // The marker is drawn first so extracted text reads in visual order.
    const baseline = this.baseline(size, template.leading);
    this.pieces(visualChunks(label, text.direction)[0].pieces, markerX, baseline, size);
    if (!lines.length) this.y -= template.leading;
    for (const line of lines)
      this.draw(
        line,
        rtl ? left : left + textIndent,
        size,
        template.leading,
        textWidth,
        text.direction,
      );
    this.y -= template.itemAfter;
  }
}

/**
 * Lays out Markdown as a formatted PDF. Liberation Sans prints what it can; Hebrew uses the bundled
 * Noto font and other scripts use fonts from `fonts`, which defaults to installed system fonts.
 * Text no font can show, or a script that needs shaping, stops the export with an error naming
 * the character.
 */
export async function formattedPdf(
  markdown: string,
  kind: DocumentKind,
  fonts: FontSearch = systemFonts(),
): Promise<RenderedDocument> {
  const blocks = parseMarkdown(markdown);
  const document = await PDFDocument.create({ updateMetadata: false });
  const choice = await FontChoice.open(fonts);
  await choice.cover(documentTexts(blocks), kind);
  const { embedded, shaped } = await choice.embed(document);
  const writer = new PageWriter(document, templates[kind], { choice, embedded, shaped });
  for (const block of blocks) writer.block(block);
  const heading = blocks.find((block) => block.kind === 'heading');
  document.setTitle(heading ? visibleText(heading.runs).trim() : labels[kind]);
  document.setCreator('Pitchcrew');
  document.setProducer('Pitchcrew');
  document.setCreationDate(new Date(0));
  document.setModificationDate(new Date(0));
  return { bytes: Buffer.from(await document.save()), pages: document.getPageCount() };
}
