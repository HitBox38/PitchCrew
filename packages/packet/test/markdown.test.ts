import { describe, expect, it } from 'vitest';
import { parseInline, visibleText } from '../src/documents/inline.ts';
import { parseMarkdown } from '../src/documents/markdown.ts';
import type { Block, Run } from '../src/documents/types.ts';

// Compact notation: [b]bold[/], [i]italic[/], [bi]both[/], {url|text}, / for a line break.
function show(runs: Run[]) {
  return runs
    .map((run) => {
      if (run.kind === 'break') return '/';
      if (run.kind === 'fill') return '>>';
      const style = `${run.bold ? 'b' : ''}${run.italic ? 'i' : ''}`;
      const text = style ? `[${style}]${run.text}[/]` : run.text;
      return run.href ? `{${run.href}|${text}}` : text;
    })
    .join('');
}
function outline(blocks: Block[]) {
  return blocks.map((block) => {
    if (block.kind === 'rule') return '---';
    if (block.kind === 'heading') return `h${block.level} ${show(block.runs)}`;
    if (block.kind === 'paragraph') return `p ${show(block.runs)}`;
    return block.items.map(
      (item) =>
        `${'  '.repeat(item.depth)}${item.ordered ? `${item.number}.` : '-'} ${show(item.runs)}`,
    );
  });
}

describe('Markdown document model', () => {
  it('ignores pandoc frontmatter and removes raw LaTeX without printing it', () => {
    const markdown = [
      '---',
      'title: "Fictional Person"',
      'geometry: margin=0.35in',
      'header-includes:',
      '  - \\usepackage{hyperref}',
      '---',
      '\\pagestyle{empty}',
      '\\raggedright',
      '',
      '# Robin Example',
      '\\vspace{-8pt}',
      '\\noindent \\textbf{Platform Engineer} at \\textsc{Contoso} \\hfill 2021--2024',
      '',
      '```{=latex}',
      '\\vspace{4pt}',
      '```',
      '',
      '\\section*{Skills}',
      '\\setlength{\\parskip}{0pt} Go, \\emph{TypeScript} and \\href{https://example.com}{a site}',
    ].join('\n');
    expect(outline(parseMarkdown(markdown))).toEqual([
      'h1 Robin Example',
      'p [b]Platform Engineer[/] at Contoso >>2021\u20132024',
      'h2 Skills',
      'p Go, [i]TypeScript[/] and {https://example.com|a site}',
    ]);
    const text = JSON.stringify(parseMarkdown(markdown));
    for (const hidden of ['title:', 'geometry', 'vspace', 'pagestyle', 'raggedright', '8pt', '\\'])
      expect(text).not.toContain(hidden);
  });

  it('keeps a leading rule when no frontmatter closes', () => {
    expect(outline(parseMarkdown('---\n\nNot metadata'))).toEqual(['---', 'p Not metadata']);
  });

  it('parses headings, nested emphasis and literal delimiters', () => {
    expect(
      outline(parseMarkdown('Robin\n=====\n\nRole\n----\n### Three\n#### Four\n##### Five')),
    ).toEqual(['h1 Robin', 'h2 Role', 'h3 Three', 'h4 Four', 'h4 Five']);
    const cases: [string, string][] = [
      ['**bold *both* bold**', '[b]bold [/][bi]both[/][b] bold[/]'],
      ['***both***', '[bi]both[/]'],
      ['**bold *and both***', '[b]bold [/][bi]and both[/]'],
      ['*a **b** c*', '[i]a [/][bi]b[/][i] c[/]'],
      ['__bold__ and _it_', '[b]bold[/] and [i]it[/]'],
      ['snake_case_name and 2 * 3 * 4', 'snake_case_name and 2 * 3 * 4'],
      ['*unclosed and `co*de`', '*unclosed and co*de'],
      ['\\*literal\\* \\_text\\_', '*literal* _text_'],
      ['A&amp;B &ndash; &#65;&#x42; &bogus;', 'A&B \u2013 AB &bogus;'],
    ];
    for (const [source, expected] of cases) expect(show(parseInline(source))).toBe(expected);
  });

  it('keeps HTML and unsafe links as visible text without executing or fetching them', () => {
    expect(show(parseInline('<script>fetch("https://example.com/x")</script> one<br>two'))).toBe(
      '<script>fetch("{https://example.com/x|https://example.com/x}")</script> one/two',
    );
    expect(
      show(parseInline('[click](javascript:alert(1)) ![logo](https://example.com/a.png)')),
    ).toBe('click logo');
    expect(show(parseInline('<!-- note --> &lt;b&gt;'))).toBe('<!-- note --> <b>');
  });

  it('links inline, angle, bare, email and reference targets', () => {
    const blocks = parseMarkdown(
      [
        '[Site](https://example.com/a_(b)) <https://example.org> robin@example.com,',
        'https://example.net/path. [Ref][r] [Short] [Domain](example.com/me)',
        '',
        '[r]: https://ref.example.com "Title"',
        '[short]: <mailto:robin@example.com>',
      ].join('\n'),
    );
    expect(outline(blocks)).toEqual([
      'p {https://example.com/a_(b)|Site} {https://example.org|https://example.org} ' +
        '{mailto:robin@example.com|robin@example.com}, {https://example.net/path|https://example.net/path}. ' +
        '{https://ref.example.com|Ref} {mailto:robin@example.com|Short} {https://example.com/me|Domain}',
    ]);
  });

  it('parses bullet, nested and numbered lists with continuations', () => {
    const markdown = [
      '- First item',
      '  wraps here',
      '  - Nested **bold**',
      '    1. Deep one',
      '    2. Deep two',
      '',
      '      continued after a blank line',
      '* Back to top',
      '',
      '3) Starts at three',
      '4) Next',
      '',
      'After the list',
    ].join('\n');
    expect(outline(parseMarkdown(markdown))).toEqual([
      [
        '- First item wraps here',
        '  - Nested [b]bold[/]',
        '    1. Deep one',
        '    2. Deep two/continued after a blank line',
        '- Back to top',
        '3. Starts at three',
        '4. Next',
      ],
      'p After the list',
    ]);
  });

  it('keeps hard line breaks, rules and fenced code', () => {
    expect(
      outline(
        parseMarkdown('Line one  \nLine two\\\nLine three\n\n***\n\n```\n**not bold**\n  x\n```'),
      ),
    ).toEqual(['p Line one/Line two/Line three', '---', 'p **not bold**/  x']);
    expect(visibleText(parseInline('a\\hfill b'))).toBe('a b');
  });
});
