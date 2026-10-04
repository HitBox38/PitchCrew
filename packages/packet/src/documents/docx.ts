import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  LineRuleType,
  Packer,
  Paragraph,
  type ParagraphChild,
  Tab,
  TabStopType,
  TextRun,
} from 'docx';
import { visibleText } from './inline.ts';
import { parseMarkdown } from './markdown.ts';
import { linkColor, type Template, templates } from './template.ts';
import type { Block, DocumentKind, ListItem, Run } from './types.ts';
import { readZip, writeZip } from './zip.ts';

const twips = (points: number) => Math.round(points * 20);
const halfPoints = (points: number) => Math.round(points * 2);
const markers = ['\u2022', '\u25e6', '\u25aa', '\u25aa'];
const headingLevels = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
];
const exact = (points: number) => ({ line: twips(points), lineRule: LineRuleType.EXACT });

// Word stores page counts in docProps/app.xml and refreshes them on save.
const appXml = (pages: number) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Pitchcrew</Application><Pages>${pages}</Pages></Properties>`;

// The docx package stamps the current time and random relationship IDs into every file. Fixed
// dates, ordered link IDs and a deterministic ZIP writer make identical input produce identical bytes.
export function normalizeDocx(bytes: Buffer, pages?: number): Buffer {
  const entries = readZip(bytes).filter((entry) => !entry.name.endsWith('/'));
  const text = (name: string) => entries.find((entry) => entry.name === name);
  const replace = (name: string, change: (xml: string) => string) => {
    const entry = text(name);
    if (entry) entry.data = Buffer.from(change(entry.data.toString('utf8')), 'utf8');
  };
  replace('docProps/core.xml', (xml) =>
    xml.replace(/(<dcterms:(?:created|modified)[^>]*>)[^<]*/g, '$11970-01-01T00:00:00Z'),
  );
  if (pages !== undefined) replace('docProps/app.xml', () => appXml(pages));
  const ids = new Map<string, string>();
  replace('word/_rels/document.xml.rels', (xml) =>
    xml.replace(/<Relationship\b[^>]*>/g, (element) => {
      const id = /\bId="([^"]+)"/.exec(element)?.[1];
      if (!id || !/\/hyperlink"/.test(element)) return element;
      const stable = `rIdLink${ids.size + 1}`;
      ids.set(id, stable);
      return element.replace(`Id="${id}"`, `Id="${stable}"`);
    }),
  );
  replace('word/document.xml', (xml) =>
    xml.replace(/\br:id="([^"]+)"/g, (match, id: string) =>
      ids.has(id) ? `r:id="${ids.get(id)}"` : match,
    ),
  );
  return writeZip(entries);
}

const clean = (text: string) => text.replace(/[\t\n\v\f\r]/g, ' ');

function children(runs: Run[], forceBold = false): ParagraphChild[] {
  return runs.map((run) => {
    if (run.kind === 'break') return new TextRun({ text: '', break: 1 });
    if (run.kind === 'fill') return new TextRun({ children: [new Tab()] });
    const text = new TextRun({
      text: clean(run.text),
      ...(forceBold || run.bold ? { bold: true } : {}),
      ...(run.italic ? { italics: true } : {}),
      ...(run.href ? { color: linkColor.hex } : {}),
    });
    return run.href ? new ExternalHyperlink({ link: run.href, children: [text] }) : text;
  });
}

function numbering(blocks: Block[], template: Template) {
  const references = new Map<ListItem, string>();
  const sequences: { reference: string; depth: number; start: number }[] = [];
  for (const block of blocks) {
    if (block.kind !== 'list') continue;
    const active: ({ reference: string; next: number } | undefined)[] = [];
    for (const item of block.items) {
      active.length = item.depth + 1;
      if (!item.ordered) {
        active[item.depth] = undefined;
        continue;
      }
      let sequence = active[item.depth];
      if (!sequence || sequence.next !== item.number) {
        const reference = `numbers-${sequences.length + 1}`;
        sequences.push({ reference, depth: item.depth, start: item.number });
        sequence = { reference, next: item.number };
        active[item.depth] = sequence;
      }
      references.set(item, sequence.reference);
      sequence.next = item.number + 1;
    }
  }
  const level = (depth: number, extra: number) => ({
    indent: {
      left: twips(depth * template.indent + template.hang + extra),
      hanging: twips(template.hang + extra),
    },
  });
  const ordered = sequences.map((sequence) => ({
    reference: sequence.reference,
    levels: [0, 1, 2, 3].map((depth) => ({
      level: depth,
      format: LevelFormat.DECIMAL,
      text: `%${depth + 1}.`,
      start: depth === sequence.depth ? sequence.start : 1,
      alignment: AlignmentType.LEFT,
      style: { paragraph: level(depth, 4) },
    })),
  }));
  return {
    references,
    config: [
      {
        reference: 'bullets',
        levels: [0, 1, 2, 3].map((depth) => ({
          level: depth,
          format: LevelFormat.BULLET,
          text: markers[depth],
          alignment: AlignmentType.LEFT,
          style: { paragraph: level(depth, 0) },
        })),
      },
      ...ordered,
    ],
  };
}

export async function formattedDocx(markdown: string, kind: DocumentKind, pages?: number) {
  const template = templates[kind];
  const blocks = parseMarkdown(markdown);
  const width = template.page[0] - template.margin * 2;
  const tabs = (runs: Run[]) =>
    runs.some((run) => run.kind === 'fill')
      ? { tabStops: [{ type: TabStopType.RIGHT, position: twips(width) }] }
      : {};
  const lists = numbering(blocks, template);
  const paragraphs = blocks.flatMap((block): Paragraph[] => {
    if (block.kind === 'heading')
      return [
        new Paragraph({
          heading: headingLevels[block.level - 1],
          children: children(block.runs, true),
          ...tabs(block.runs),
        }),
      ];
    if (block.kind === 'paragraph')
      return [new Paragraph({ children: children(block.runs), ...tabs(block.runs) })];
    if (block.kind === 'rule')
      return [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '8C8C8C', space: 1 } },
          spacing: { before: twips(3), after: twips(5), ...exact(2) },
        }),
      ];
    return block.items.map(
      (item: ListItem, index) =>
        new Paragraph({
          children: children(item.runs),
          numbering: {
            reference: item.ordered ? lists.references.get(item)! : 'bullets',
            level: item.depth,
          },
          spacing: {
            after: twips(
              index === block.items.length - 1 ? template.paragraphAfter : template.itemAfter,
            ),
          },
          ...tabs(item.runs),
        }),
    );
  });
  const heading = (level: 0 | 1 | 2 | 3) => {
    const style = template.headings[level];
    return {
      run: { font: 'Arial', size: halfPoints(style.size), bold: true, color: '000000' },
      paragraph: {
        keepNext: true,
        spacing: {
          before: twips(style.before),
          after: twips(style.after),
          ...exact(style.leading),
        },
        ...(style.rule
          ? {
              border: { bottom: { style: BorderStyle.SINGLE, size: 5, color: '8C8C8C', space: 1 } },
            }
          : {}),
      },
    };
  };
  const first = blocks.find((block) => block.kind === 'heading');
  const document = new Document({
    creator: 'Pitchcrew',
    title: first ? visibleText(first.runs).trim() : kind === 'resume' ? 'Resume' : 'Cover letter',
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: halfPoints(template.size), color: '000000' },
          paragraph: {
            spacing: { after: twips(template.paragraphAfter), ...exact(template.leading) },
          },
        },
        heading1: heading(0),
        heading2: heading(1),
        heading3: heading(2),
        heading4: heading(3),
      },
    },
    numbering: { config: lists.config },
    sections: [
      {
        properties: {
          page: {
            size: { width: twips(template.page[0]), height: twips(template.page[1]) },
            margin: {
              top: twips(template.margin),
              right: twips(template.margin),
              bottom: twips(template.margin),
              left: twips(template.margin),
              header: 0,
              footer: 0,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });
  return normalizeDocx(await Packer.toBuffer(document), pages);
}
