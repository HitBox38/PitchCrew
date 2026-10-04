import { parseInline, type References, visibleText } from './inline.ts';
import type { Block, ListItem } from './types.ts';

const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const rule = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const listItem = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const latexSection = /^\\(section|subsection|subsubsection)\*?\{(.*)\}\s*$/;
const reference =
  /^ {0,3}\[([^\]]+)\]:[ \t]*<?(\S+?)>?(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/;

const indentOf = (line: string) => line.match(/^[ \t]*/)![0].replace(/\t/g, '    ').length;
const hardBreak = (line: string) => / {2,}$|\\\\(\[[^\]]*\])?\s*$|(?<!\\)\\$/.test(line);
const withoutBreak = (line: string) =>
  line.replace(/ {2,}$|\\\\(\[[^\]]*\])?\s*$|(?<!\\)\\$/, '').trim();

// Pandoc YAML metadata is configuration for another renderer; it is not printed.
function withoutFrontmatter(lines: string[]) {
  if (lines[0]?.trim() !== '---') return lines;
  const end = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)\s*$/.test(line));
  const first = lines.slice(1, end).find((line) => line.trim());
  if (end < 0 || (first !== undefined && !/^\s*([\w-]+\s*:|#)/.test(first))) return lines;
  return lines.slice(end + 1);
}

// Expands raw LaTeX fences into ordinary lines, keeps other fenced code literal and removes
// pandoc div fences and reference definitions, which have no printed words.
function prepare(lines: string[], references: References) {
  const output: { text: string; literal: boolean }[] = [];
  for (let index = 0; index < lines.length; index++) {
    const fence = /^ {0,3}(`{3,}|~{3,})\s*(.*)$/.exec(lines[index]);
    if (fence) {
      const close = lines.findIndex(
        (line, position) =>
          position > index &&
          line.trim().startsWith(fence[1]) &&
          !line.trim().slice(fence[1].length).trim(),
      );
      const end = close < 0 ? lines.length : close;
      const raw = /^\{\s*=(latex|tex)\s*\}$/.test(fence[2].trim());
      output.push({ text: '', literal: false });
      for (const line of lines.slice(index + 1, end)) output.push({ text: line, literal: !raw });
      output.push({ text: '', literal: false });
      index = end;
      continue;
    }
    if (/^ {0,3}:{3,}/.test(lines[index])) continue;
    const definition = reference.exec(lines[index]);
    if (definition) {
      references.set(definition[1].trim().toLowerCase(), definition[2]);
      continue;
    }
    output.push({ text: lines[index], literal: false });
  }
  return output;
}

export function parseMarkdown(markdown: string): Block[] {
  const source = markdown
    .replace(/^\ufeff/, '')
    .normalize('NFC')
    .replace(/\r\n?/g, '\n');
  const references: References = new Map();
  const lines = prepare(withoutFrontmatter(source.split('\n')), references);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let literal: string[] = [];
  let items: ListItem[] | undefined;
  let item: { depth: number; ordered: boolean; number: number; text: string } | undefined;
  let indents: number[] = [];
  let counters: (number | undefined)[] = [];
  let blank = false;

  const joined = (texts: string[]) =>
    texts
      .map((text, index) =>
        index < texts.length - 1 && hardBreak(text)
          ? `${withoutBreak(text)}\n`
          : `${withoutBreak(text)} `,
      )
      .join('')
      .trim();
  const closeItem = () => {
    if (item && items) {
      const runs = parseInline(withoutBreak(item.text), references);
      items.push({ depth: item.depth, ordered: item.ordered, number: item.number, runs });
    }
    item = undefined;
  };
  const closeList = () => {
    closeItem();
    if (items?.length) blocks.push({ kind: 'list', items });
    items = undefined;
    indents = [];
    counters = [];
  };
  const closeParagraph = () => {
    const runs = parseInline(joined(paragraph), references);
    if (runs.length) blocks.push({ kind: 'paragraph', runs });
    paragraph = [];
  };
  const closeLiteral = () => {
    const runs = literal.flatMap((text, index) => [
      ...(index ? [{ kind: 'break' as const }] : []),
      { kind: 'text' as const, text: text.replace(/\t/g, '    '), bold: false, italic: false },
    ]);
    if (literal.some((text) => text.trim())) blocks.push({ kind: 'paragraph', runs });
    literal = [];
  };
  const closeAll = () => {
    closeParagraph();
    closeList();
    closeLiteral();
  };

  for (const { text: raw, literal: isLiteral } of lines) {
    if (isLiteral) {
      closeParagraph();
      closeList();
      literal.push(raw);
      continue;
    }
    closeLiteral();
    const line = raw.replace(/^ {0,3}> ?/, '');
    // A line made only of LaTeX layout commands, such as \vspace{-8pt}, disappears entirely.
    if (/^\s*\\[A-Za-z]/.test(line) && !latexSection.test(line.trim())) {
      if (!visibleText(parseInline(line, references)).trim() && !/^\s*\\\\/.test(line)) continue;
    }
    if (/^\s*\\\\(\[[^\]]*\])?\s*$/.test(line)) continue;
    if (!line.trim()) {
      closeParagraph();
      blank = true;
      continue;
    }
    const section = latexSection.exec(line.trim());
    const atx = heading.exec(line);
    if (atx || section) {
      closeAll();
      const level = section
        ? ({ section: 2, subsection: 3, subsubsection: 4 } as const)[section[1] as 'section']
        : (Math.min(atx![1].length, 4) as 1 | 2 | 3 | 4);
      const runs = parseInline(section ? section[2] : (atx![2] ?? ''), references);
      if (runs.length) blocks.push({ kind: 'heading', level, runs });
      blank = false;
      continue;
    }
    if (paragraph.length && !items && /^ {0,3}(=+|-+)[ \t]*$/.test(line)) {
      const runs = parseInline(joined(paragraph), references);
      paragraph = [];
      if (runs.length)
        blocks.push({ kind: 'heading', level: line.trim()[0] === '=' ? 1 : 2, runs });
      blank = false;
      continue;
    }
    if (rule.test(line)) {
      closeAll();
      blocks.push({ kind: 'rule' });
      blank = false;
      continue;
    }
    const marker = listItem.exec(line);
    if (marker) {
      closeParagraph();
      closeItem();
      items ??= [];
      const indent = indentOf(marker[1]);
      while (indents.length && indent < indents.at(-1)!) indents.pop();
      if (!indents.length || indent >= indents.at(-1)! + 2) indents.push(indent);
      const depth = Math.min(indents.length - 1, 3);
      counters = counters.slice(0, depth + 1);
      const ordered = /\d/.test(marker[2]);
      const number = ordered ? (counters[depth] ?? Number.parseInt(marker[2], 10) - 1) + 1 : 0;
      counters[depth] = ordered ? number : undefined;
      item = { depth, ordered, number, text: marker[3] };
      blank = false;
      continue;
    }
    if (item && (!blank || indentOf(line) >= 2)) {
      const previous =
        blank || hardBreak(item.text) ? `${withoutBreak(item.text)}\n` : `${item.text} `;
      item.text = `${previous}${line.trim()}`;
      blank = false;
      continue;
    }
    closeList();
    paragraph.push(line);
    blank = false;
  }
  closeAll();
  return blocks;
}
