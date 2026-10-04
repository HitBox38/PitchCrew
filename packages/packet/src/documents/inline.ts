import type { Run } from './types.ts';

// Inline Markdown with the raw LaTeX that pandoc resumes commonly carry. Nothing is fetched or
// executed: links become annotations, HTML stays visible text and LaTeX commands are not printed.
interface Style {
  bold: boolean;
  italic: boolean;
  href?: string;
}
export type References = Map<string, string>;

const punctuation = /^[!-/:-@[-`{-~]$/;
const entities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  ndash: '\u2013',
  mdash: '\u2014',
  hellip: '\u2026',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
  middot: '\u00b7',
  bull: '\u2022',
  copy: '\u00a9',
  reg: '\u00ae',
  trade: '\u2122',
  euro: '\u20ac',
};
// Layout, spacing and preamble commands: their arguments are settings, not document words.
const dropped = new Set(
  (
    'vspace hspace vskip hskip pagestyle thispagestyle setlength addtolength setcounter newpage ' +
    'pagebreak clearpage nopagebreak noindent indent raggedright raggedleft centering small ' +
    'footnotesize scriptsize tiny large Large LARGE huge Huge normalsize bigskip medskip ' +
    'smallskip vfill par begin end usepackage documentclass geometry renewcommand ' +
    'newcommand definecolor color fontsize selectfont linespread setstretch label phantom ' +
    'hypersetup titlespacing titleformat setlist columnbreak null relax strut sloppy fussy ' +
    'bfseries itshape mdseries upshape rmfamily sffamily ttfamily normalfont includegraphics ' +
    'maketitle tableofcontents hrule hline item pagenumbering enlargethispage'
  ).split(' '),
);
const symbols: Record<string, string> = {
  LaTeX: 'LaTeX',
  TeX: 'TeX',
  ldots: '\u2026',
  dots: '\u2026',
  textbullet: '\u2022',
  textbar: '|',
  textendash: '\u2013',
  textemdash: '\u2014',
  cdot: '\u00b7',
  quad: ' ',
  qquad: ' ',
  enspace: ' ',
  textasciitilde: '~',
  textbackslash: '\\',
};

const isSpace = (character: string | undefined) => !character || /\s/.test(character);
const isWord = (character: string | undefined) => !!character && /[\p{L}\p{N}]/u.test(character);

export function safeHref(target: string): string | undefined {
  const url = target.trim();
  if (/^(https?:\/\/|mailto:|tel:)\S+$/i.test(url)) return url;
  if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(url)) return `mailto:${url}`;
  if (/^(www\.)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(url)) return `https://${url}`;
  return undefined;
}

function runLength(text: string, index: number, character: string) {
  let end = index;
  while (text[end] === character) end++;
  return end - index;
}

// Returns the end index (exclusive) of a balanced group that starts at `index`.
function groupEnd(text: string, index: number, open: string, close: string) {
  if (text[index] !== open) return -1;
  let depth = 0;
  for (let cursor = index; cursor < text.length; cursor++) {
    if (text[cursor] === '\\') cursor++;
    else if (text[cursor] === open) depth++;
    else if (text[cursor] === close && --depth === 0) return cursor + 1;
  }
  return -1;
}

function codeSpanEnd(text: string, index: number) {
  const length = runLength(text, index, '`');
  for (let cursor = index + length; cursor < text.length; cursor++) {
    if (text[cursor] !== '`') continue;
    const closing = runLength(text, cursor, '`');
    if (closing === length) return cursor + closing;
    cursor += closing - 1;
  }
  return -1;
}

// Finds the closing delimiter run for emphasis opened with `length` characters.
function closer(text: string, from: number, character: string, length: number): number {
  for (let cursor = from; cursor < text.length;) {
    const current = text[cursor];
    if (current === '\\') {
      cursor += 2;
      continue;
    }
    if (current === '`') {
      const end = codeSpanEnd(text, cursor);
      cursor = end < 0 ? cursor + runLength(text, cursor, '`') : end;
      continue;
    }
    if (current !== character) {
      cursor++;
      continue;
    }
    const run = runLength(text, cursor, character);
    const before = text[cursor - 1];
    const after = text[cursor + run];
    const canClose = cursor > from && !isSpace(before) && (character !== '_' || !isWord(after));
    const canOpen = !isSpace(after) && (character !== '_' || !isWord(before));
    if (canClose && (run === length || (run > length && !canOpen))) return cursor;
    if (canOpen) {
      const nested = closer(text, cursor + run, character, run);
      if (nested >= 0) {
        cursor = nested + run;
        continue;
      }
    }
    cursor += run;
  }
  return -1;
}

interface Destination {
  href: string;
  end: number;
}
function destination(text: string, index: number): Destination | undefined {
  if (text[index] !== '(') return undefined;
  let cursor = index + 1;
  while (text[cursor] === ' ') cursor++;
  let href = '';
  if (text[cursor] === '<') {
    const end = text.indexOf('>', cursor);
    if (end < 0) return undefined;
    href = text.slice(cursor + 1, end);
    cursor = end + 1;
  } else {
    let depth = 0;
    while (cursor < text.length && !/\s/.test(text[cursor])) {
      if (text[cursor] === '(') depth++;
      if (text[cursor] === ')' && depth-- === 0) break;
      href += text[cursor++];
    }
  }
  while (text[cursor] === ' ') cursor++;
  if (text[cursor] === '"' || text[cursor] === "'") {
    const end = text.indexOf(text[cursor], cursor + 1);
    if (end < 0) return undefined;
    cursor = end + 1;
    while (text[cursor] === ' ') cursor++;
  }
  return text[cursor] === ')' ? { href, end: cursor + 1 } : undefined;
}

// Pandoc-style dashes for date ranges, leaving HTML comment markers such as <!-- untouched.
const smartDashes = (text: string) =>
  text.replace(/(?<![!<-])---(?![->])/g, '\u2014').replace(/(?<![!<-])--(?![->])/g, '\u2013');

class InlineParser {
  readonly runs: Run[] = [];
  constructor(private references: References) {}

  text(text: string, style: Style, literal = false) {
    if (!text) return;
    if (literal || style.href) {
      this.runs.push({
        kind: 'text',
        text,
        bold: style.bold,
        italic: style.italic,
        href: style.href,
      });
      return;
    }
    // Bare web addresses and email addresses become links; trailing punctuation stays text.
    const pattern = /https?:\/\/[^\s<>"]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
    let last = 0;
    for (const match of text.matchAll(pattern)) {
      let url = match[0];
      while (/[.,;:!?)]$/.test(url) && !(url.endsWith(')') && url.includes('(')))
        url = url.slice(0, -1);
      this.text(smartDashes(text.slice(last, match.index)), style, true);
      this.text(url, { ...style, href: safeHref(url) }, true);
      last = match.index + url.length;
    }
    this.text(smartDashes(text.slice(last)), style, true);
  }

  latex(source: string, index: number, style: Style): number {
    const name = /^[A-Za-z]+\*?/.exec(source.slice(index + 1))![0];
    let cursor = index + 1 + name.length;
    const command = name.replace('*', '');
    const options: string[] = [];
    const args: string[] = [];
    while (source[cursor] === '[' || source[cursor] === '{') {
      const end = groupEnd(source, cursor, source[cursor], source[cursor] === '[' ? ']' : '}');
      if (end < 0) break;
      (source[cursor] === '[' ? options : args).push(source.slice(cursor + 1, end - 1));
      cursor = end;
    }
    if (!args.length && !options.length) while (source[cursor] === ' ') cursor++;
    if (command === 'newline' || command === 'linebreak') this.runs.push({ kind: 'break' });
    else if (command === 'hfill') this.runs.push({ kind: 'fill' });
    else if (Object.hasOwn(symbols, command)) this.text(symbols[command], style, true);
    else if (command === 'textbf') this.parse(args.join(' '), { ...style, bold: true });
    else if (['textit', 'emph', 'textsl'].includes(command))
      this.parse(args.join(' '), { ...style, italic: true });
    else if (command === 'href' && args.length === 2)
      this.parse(args[1], { ...style, href: style.href ?? safeHref(args[0]) });
    else if (command === 'url' && args.length === 1)
      this.text(args[0], { ...style, href: style.href ?? safeHref(args[0]) }, true);
    else if (command === 'textcolor') this.parse(args.slice(1).join(' '), style);
    else if (!dropped.has(command)) this.parse(args.join(' '), style);
    return cursor;
  }

  link(source: string, index: number, style: Style): number {
    const image = source[index] === '!';
    const open = image ? index + 1 : index;
    const close = groupEnd(source, open, '[', ']');
    if (close < 0) return -1;
    const label = source.slice(open + 1, close - 1);
    const target = destination(source, close);
    let href: string | undefined;
    let end = close;
    if (target) {
      href = target.href;
      end = target.end;
    } else if (source[close] === '[') {
      const referenceEnd = groupEnd(source, close, '[', ']');
      const key = referenceEnd < 0 ? '' : source.slice(close + 1, referenceEnd - 1) || label;
      href = this.references.get(key.trim().toLowerCase());
      if (href === undefined) return -1;
      end = referenceEnd;
    } else if (source[close] === '{') {
      // Pandoc bracketed span: keep the words, drop the attributes.
      const attributes = groupEnd(source, close, '{', '}');
      if (attributes < 0) return -1;
      this.parse(label, style);
      return attributes;
    } else {
      href = this.references.get(label.trim().toLowerCase());
      if (href === undefined) return -1;
    }
    // Images are never loaded; their alternative text stays visible.
    this.parse(label, image ? style : { ...style, href: style.href ?? safeHref(href) });
    return end;
  }

  angle(source: string, index: number, style: Style): number {
    const end = source.indexOf('>', index);
    if (end < 0) return -1;
    const inner = source.slice(index + 1, end);
    if (/^br\s*\/?$/i.test(inner)) {
      this.runs.push({ kind: 'break' });
      return end + 1;
    }
    const href = /^[a-z][\w+.-]*:\S+$|^[\w.+-]+@[\w-]+(\.[\w-]+)+$/i.test(inner)
      ? safeHref(inner)
      : undefined;
    if (!href) return -1;
    this.text(inner, { ...style, href: style.href ?? href }, true);
    return end + 1;
  }

  parse(source: string, style: Style) {
    let plain = '';
    const flush = () => {
      this.text(plain, style);
      plain = '';
    };
    for (let index = 0; index < source.length;) {
      const character = source[index];
      const next = source[index + 1];
      if (character === '\n') {
        flush();
        this.runs.push({ kind: 'break' });
        index++;
      } else if (character === '\\' && next && /[A-Za-z]/.test(next)) {
        flush();
        index = this.latex(source, index, style);
      } else if (character === '\\' && next && punctuation.test(next)) {
        flush();
        this.text(next, style, true);
        index += 2;
      } else if (character === '`') {
        const end = codeSpanEnd(source, index);
        const length = runLength(source, index, '`');
        if (end < 0) {
          plain += source.slice(index, index + length);
          index += length;
        } else {
          flush();
          const code = source.slice(index + length, end - length);
          this.text(code.replace(/^ (.*) $/, '$1'), style, true);
          index = end;
        }
      } else if (character === '*' || character === '_') {
        const length = runLength(source, index, character);
        const canOpen =
          length <= 3 &&
          !isSpace(source[index + length]) &&
          (character !== '_' || !isWord(source[index - 1]));
        let matched = false;
        for (let size = Math.min(length, 3); canOpen && size >= 1 && !matched; size--) {
          const end = closer(source, index + size, character, size);
          if (end < 0) continue;
          flush();
          this.parse(source.slice(index + size, end), {
            ...style,
            bold: style.bold || size >= 2,
            italic: style.italic || size !== 2,
          });
          index = end + size;
          matched = true;
        }
        if (!matched) {
          plain += source.slice(index, index + length);
          index += length;
        }
      } else if (character === '[' || (character === '!' && next === '[')) {
        flush();
        const end = this.link(source, index, style);
        if (end < 0) {
          plain += character;
          index++;
        } else index = end;
      } else if (character === '<') {
        flush();
        const end = this.angle(source, index, style);
        if (end < 0) {
          plain += character;
          index++;
        } else index = end;
      } else if (character === '&') {
        const entity = /^&(?:#(\d{1,7})|#x([\da-f]{1,6})|([a-z]+));/i.exec(source.slice(index));
        const code = entity?.[1] ? Number(entity[1]) : Number.parseInt(entity?.[2] ?? '', 16);
        const decoded =
          code > 0 && code <= 0x10ffff
            ? String.fromCodePoint(code)
            : Object.hasOwn(entities, entity?.[3] ?? '')
              ? entities[entity![3]]
              : undefined;
        if (entity && decoded !== undefined) {
          plain += decoded;
          index += entity[0].length;
        } else {
          plain += character;
          index++;
        }
      } else {
        plain += character;
        index++;
      }
    }
    flush();
  }
}

export function mergeRuns(runs: Run[]): Run[] {
  const output: Run[] = [];
  for (const run of runs) {
    const last = output.at(-1);
    if (run.kind === 'text' && !run.text) continue;
    if (
      run.kind === 'text' &&
      last?.kind === 'text' &&
      last.bold === run.bold &&
      last.italic === run.italic &&
      last.href === run.href
    )
      output[output.length - 1] = { ...last, text: last.text + run.text };
    else output.push(run);
  }
  while (output[0]?.kind === 'break') output.shift();
  while (output.at(-1)?.kind === 'break') output.pop();
  const first = output[0];
  if (first?.kind === 'text') output[0] = { ...first, text: first.text.trimStart() };
  const last = output.at(-1);
  if (last?.kind === 'text') output[output.length - 1] = { ...last, text: last.text.trimEnd() };
  return output.filter((run) => run.kind !== 'text' || run.text);
}

export function parseInline(source: string, references: References = new Map()): Run[] {
  const parser = new InlineParser(references);
  parser.parse(source, { bold: false, italic: false });
  return mergeRuns(parser.runs);
}

export const visibleText = (runs: Run[]) =>
  runs.map((run) => (run.kind === 'text' ? run.text : run.kind === 'fill' ? ' ' : '\n')).join('');
