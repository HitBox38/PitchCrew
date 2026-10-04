import {
  defaultPacketRules,
  describePacketRules,
  packetRulesSchema,
  patternProblem,
  type Packet,
  type PacketRules,
} from '@pitchcrew/core';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { packet } from '../../board/test/fixtures/packet.ts';
import { bodyText, checkPacket, countWords, lintPacket, ruleInputLimit } from '../src/index.ts';

const profile = [{ name: 'profile.md', content: '- Built React interfaces.' }];
const rules = (input: unknown): PacketRules =>
  packetRulesSchema.parse({ version: 1, rules: [input] });

/** The limits that lintPacket hardcoded before packet rules existed. */
function legacyLimits(packet: Packet) {
  const problems: string[] = [];
  if (packet.resume.split(/\s+/).length > 650) problems.push('Resume exceeds 650 words.');
  if (packet.coverLetter.split(/\s+/).length > 500)
    problems.push('Cover letter exceeds 500 words.');
  return problems;
}

describe('word counting', () => {
  it('counts body words without frontmatter, LaTeX commands, HTML or link targets', () => {
    const resume = [
      '---',
      'title: Fictional resume',
      'layout: one-page',
      '---',
      '# Avery Example \\vspace{-4pt}',
      'See [my portfolio](https://portfolio.example/avery?ref=one two) and <https://example.com/x>.',
      '<span class="role">Senior engineer</span> <!-- hidden comment words -->',
      '\\textbf{Northwind} \\\\ \\hfill 2021',
      '- Led a fictional team',
      '[ref]: https://example.com/reference',
    ].join('\n');
    expect(bodyText(resume)).not.toContain('portfolio.example');
    expect(bodyText(resume)).not.toContain('vspace');
    expect(bodyText(resume)).not.toContain('hidden comment');
    expect(bodyText(resume)).not.toContain('layout');
    // Avery Example See my portfolio and Senior engineer Northwind 2021 Led a fictional team
    expect(countWords(resume)).toBe(14);
    expect(countWords('')).toBe(0);
    expect(countWords('- * # | ---')).toBe(0);
    expect(countWords('---\nnot: closed\nStill counted')).toBe(4);
  });
  it('omits LaTeX hyperlink destinations while retaining their formatted labels', () => {
    const text = String.raw`See \href{https://example.com/one}{\textbf{my portfolio}} and \url{https://example.com/two}`;
    expect(countWords(text)).toBe(4);
    expect(bodyText(text)).not.toContain('example.com');
  });
  it('keeps the original whitespace split for the all mode', () => {
    for (const text of ['', 'one', ' one two', 'one\n\ntwo\n', 'word '.repeat(651)])
      expect(countWords(text, 'all')).toBe(text.split(/\s+/).length);
  });
});

describe('default rules', () => {
  it('reproduce the earlier 650 and 500 word limits exactly', () => {
    const cases = [
      packet,
      { ...packet, resume: 'word '.repeat(649) },
      { ...packet, resume: 'word '.repeat(650) },
      { ...packet, resume: `Built React interfaces. ${'word '.repeat(700)}` },
      { ...packet, coverLetter: `${'word '.repeat(499)}word` },
      { ...packet, coverLetter: 'Built React interfaces.\n'.repeat(200) },
      { ...packet, resume: `---\nfront: matter\n---\n${'word '.repeat(648)}` },
    ];
    for (const item of cases) {
      const legacy = legacyLimits(item);
      const check = checkPacket(item, profile);
      const limits = check.findings.filter((finding) => finding.ruleId !== 'claims');
      expect(limits.map((finding) => finding.message)).toEqual(legacy);
      expect(limits.every((finding) => finding.severity === 'error')).toBe(true);
      expect(check.warnings).toEqual([]);
      expect(checkPacket(item, profile, defaultPacketRules)).toEqual(check);
    }
    expect(lintPacket({ ...packet, resume: 'word '.repeat(651) }, profile)).toContain(
      'Resume exceeds 650 words.',
    );
  });
  it('returns findings with rule ids, documents and severities', () => {
    const check = checkPacket({ ...packet, coverLetter: 'word '.repeat(501) }, []);
    expect(check.findings).toEqual([
      {
        ruleId: 'claims',
        severity: 'error',
        document: 'claims',
        message: 'Source does not support: Built React interfaces.',
      },
      {
        ruleId: 'cover-letter-length',
        severity: 'error',
        document: 'coverLetter',
        message: 'Cover letter exceeds 500 words.',
      },
    ]);
  });
});

describe('rule kinds', () => {
  it('limits body words per document with a custom message', () => {
    const rule = rules({
      id: 'resume-body',
      kind: 'word_limit',
      severity: 'error',
      documents: ['resume', 'note'],
      max: 3,
      message: 'Keep it short.',
    });
    const resume = '---\ntitle: x\n---\nOne two \\vspace{-4pt} [three](https://a.example/b c d)';
    expect(checkPacket({ ...packet, resume }, profile, rule).errors).toEqual([]);
    expect(
      checkPacket({ ...packet, resume: `${resume} four`, note: 'a b c d e' }, profile, rule)
        .findings,
    ).toEqual([
      {
        ruleId: 'resume-body',
        severity: 'error',
        document: 'resume',
        message: 'Keep it short. (Resume: 4 words)',
      },
      {
        ruleId: 'resume-body',
        severity: 'error',
        document: 'note',
        message: 'Keep it short. (Note: 5 words)',
      },
    ]);
  });
  it('counts bullets under each heading', () => {
    const resume = [
      '# Avery Example',
      '## Northwind Labs',
      '- one',
      '- two',
      '  - nested detail',
      '- three',
      '## Contoso Studio',
      '* one',
      '1. two',
      '\\item three',
    ].join('\n');
    const markdown = rules({
      id: 'bullets',
      kind: 'max_bullets',
      severity: 'warn',
      documents: ['resume'],
      max: 2,
    });
    const check = checkPacket({ ...packet, resume }, profile, markdown);
    expect(check.errors).toEqual([]);
    expect(check.warnings).toEqual([
      'Resume has 3 bullets under "## Northwind Labs"; the limit is 2.',
      'Resume has 3 bullets under "## Contoso Studio"; the limit is 2.',
    ]);
    const jobs = rules({
      id: 'bullets',
      kind: 'max_bullets',
      severity: 'warn',
      documents: ['resume'],
      max: 2,
      heading: '^## Northwind',
    });
    expect(checkPacket({ ...packet, resume }, profile, jobs).warnings).toEqual([
      'Resume has 3 bullets under "## Northwind Labs"; the limit is 2.',
    ]);
  });
  it('starts sections at custom job header lines', () => {
    const resume = [
      '**Northwind Labs** | Engineer',
      '- one',
      '- two',
      '- three',
      '## Education',
      '- one',
      '- two',
      '- three',
    ].join('\n');
    const rule = rules({
      id: 'job-bullets',
      kind: 'max_bullets',
      severity: 'error',
      documents: ['resume'],
      max: 2,
      heading: '^\\*\\*',
    });
    expect(checkPacket({ ...packet, resume }, profile, rule).errors).toEqual([
      'Resume has 3 bullets under "**Northwind Labs** | Engineer"; the limit is 2.',
    ]);
  });
  it('requires selected lines to equal a listed entry', () => {
    const rule = rules({
      id: 'employers',
      kind: 'canonical_lines',
      severity: 'error',
      documents: ['resume'],
      selector: '^\\*\\*.+\\*\\* \\|',
      values: ['**Northwind Labs** | Senior Engineer | 2021-2024', '**Contoso Studio** | Engineer'],
    });
    const good =
      '**Northwind Labs** | Senior Engineer | 2021-2024\n  **Contoso Studio** | Engineer';
    expect(checkPacket({ ...packet, resume: good }, profile, rule).errors).toEqual([]);
    const edited = '**Northwind Labs** | Staff Engineer | 2021-2024\nPlain text line';
    expect(checkPacket({ ...packet, resume: edited }, profile, rule).errors).toEqual([
      'Resume line "**Northwind Labs** | Staff Engineer | 2021-2024" does not match any listed entry.',
    ]);
  });
  it('checks captured values against an expected value', () => {
    const rule = rules({
      id: 'team-size',
      kind: 'pattern',
      severity: 'error',
      documents: ['resume', 'coverLetter'],
      pattern: 'Led (\\d+) developers',
      equals: '3',
    });
    expect(
      checkPacket({ ...packet, resume: 'Led 3 developers. Led 3 developers.' }, profile, rule)
        .errors,
    ).toEqual([]);
    expect(
      checkPacket({ ...packet, coverLetter: 'I Led 5 developers.' }, profile, rule).findings,
    ).toEqual([
      {
        ruleId: 'team-size',
        severity: 'error',
        document: 'coverLetter',
        message: 'Cover letter has "Led 5 developers"; it must capture "3", not "5".',
      },
    ]);
  });
  it('caps pattern matches per document', () => {
    const rule = rules({
      id: 'gap-sentences',
      kind: 'pattern',
      severity: 'error',
      documents: ['coverLetter', 'formAnswers', 'note'],
      pattern: "\\bI (?:have not|haven't|don't have)\\b",
      flags: 'i',
      maxCount: 1,
      message: 'Mention at most one gap.',
    });
    const one = { ...packet, coverLetter: 'I have not used Rust.', note: "I don't have a degree." };
    expect(checkPacket(one, profile, rule).errors).toEqual([]);
    const two = { ...one, coverLetter: "I have not used Rust. I don't have Go experience." };
    expect(checkPacket(two, profile, rule).errors).toEqual([
      `Mention at most one gap. (Cover letter: 2 matches, "I have not", "I don't have")`,
    ]);
  });
  it('rejects any match when no count is allowed and keeps warnings advisory', () => {
    const file = packetRulesSchema.parse({
      version: 1,
      rules: [
        {
          id: 'no-ai-mentions',
          kind: 'pattern',
          severity: 'error',
          documents: ['resume', 'coverLetter', 'formAnswers', 'note'],
          pattern: '\\b(?:drafted|generated|checked) (?:by|with) (?:AI|an? agent|the writer)\\b',
          flags: 'i',
        },
        {
          id: 'approximate-years',
          kind: 'pattern',
          severity: 'warn',
          documents: ['resume', 'coverLetter'],
          pattern: '~\\s?\\d+ years',
        },
        {
          id: 'cover-letter-soft',
          kind: 'word_limit',
          severity: 'warn',
          documents: ['coverLetter'],
          max: 5,
        },
      ],
    });
    const warned = { ...packet, coverLetter: 'Built React interfaces. ~6 years of practice here.' };
    const check = checkPacket(warned, profile, file);
    expect(check.errors).toEqual([]);
    expect(check.warnings).toEqual([
      'Cover letter contains "~6 years", which this rule does not allow.',
      'Cover letter exceeds 5 words.',
    ]);
    expect(lintPacket(warned, profile, file)).toEqual([]);
    const blocked = { ...packet, note: 'This note was Generated by AI.' };
    expect(lintPacket(blocked, profile, file)).toEqual([
      'Note contains "Generated by AI", which this rule does not allow.',
    ]);
  });
  it('fails closed when a pattern exceeds the bounded match count', () => {
    const base = {
      id: 'many',
      kind: 'pattern',
      severity: 'error',
      documents: ['resume'],
      pattern: '(a|b)',
    };
    const resume = `${'a'.repeat(1000)}b`;
    for (const options of [{ maxCount: 1000 }, { equals: 'a' }]) {
      const check = checkPacket({ ...packet, resume }, profile, rules({ ...base, ...options }));
      expect(check.errors).toEqual([expect.stringContaining('1000 matches')]);
    }
  });
  it('bounds the text each rule reads', () => {
    const rule = rules({
      id: 'forbidden',
      kind: 'pattern',
      severity: 'warn',
      documents: ['resume'],
      pattern: 'needle',
    });
    const resume = `${'a'.repeat(ruleInputLimit)}needle`;
    const check = checkPacket({ ...packet, resume }, profile, rule);
    expect(check.warnings).toEqual([]);
    expect(check.errors).toEqual([
      `Resume is too long for rule checks (${ruleInputLimit} characters maximum).`,
    ]);
  });
});

describe('rule validation', () => {
  const base = { id: 'fixture', kind: 'pattern', severity: 'error', documents: ['resume'] };
  it.each([
    ['(a+)+', 'Nested repeats'],
    ['(\\w+\\s?)*', 'Nested repeats'],
    ['(?:x*){2,}', 'Nested repeats'],
    ['(a)\\1', 'Backreferences'],
    ['(?<word>a)\\k<word>', 'Backreferences'],
    ['[unclosed', 'does not compile'],
    ['a*', 'empty text'],
    ['x'.repeat(301), '300'],
  ])('rejects %s', (pattern, message) => {
    const result = packetRulesSchema.safeParse({ version: 1, rules: [{ ...base, pattern }] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['rules', 0, 'pattern'],
      message: expect.stringContaining(message),
    });
  });
  it.each(['Led (\\d+) developers', '(?:ab)+', '\\(a+\\)+', '[(a+)]+', '(?<=I )have'])(
    'accepts %s',
    (pattern) => expect(patternProblem(pattern)).toBeNull(),
  );
  it('validates selectors, headings, flags, ids, documents and limits', () => {
    const invalid = [
      { ...base, pattern: 'x', flags: 'g' },
      { ...base, pattern: 'x', flags: 'ii' },
      { ...base, pattern: 'x', documents: [] },
      { ...base, pattern: 'x', documents: ['resume', 'resume'] },
      { ...base, pattern: 'x', documents: ['claims'] },
      { ...base, pattern: 'x', severity: 'info' },
      { ...base, pattern: 'x', id: 'Not Valid' },
      { ...base, pattern: 'x', maxCount: 1, equals: '3' },
      { ...base, pattern: 'x', unknown: true },
      { ...base, kind: 'canonical_lines', selector: '(a*)*', values: ['x'] },
      { ...base, kind: 'canonical_lines', selector: 'x', values: [] },
      { ...base, kind: 'max_bullets', max: 2, heading: '(\\s+)+' },
      { ...base, kind: 'word_limit', max: 0 },
      { ...base, kind: 'unknown' },
    ];
    for (const rule of invalid)
      expect(
        packetRulesSchema.safeParse({ version: 1, rules: [rule] }).success,
        JSON.stringify(rule),
      ).toBe(false);
    expect(
      packetRulesSchema.safeParse({
        version: 1,
        rules: [
          { ...base, pattern: 'x' },
          { ...base, pattern: 'y' },
        ],
      }).error?.issues,
    ).toEqual([expect.objectContaining({ path: ['rules', 1, 'id'] })]);
    const many = Array.from({ length: 51 }, (_, index) => ({
      ...base,
      id: `rule-${index}`,
      pattern: 'x',
    }));
    expect(packetRulesSchema.safeParse({ version: 1, rules: many }).error?.issues).toEqual([
      expect.objectContaining({ path: ['rules'], message: expect.stringContaining('50 patterns') }),
    ]);
    expect(packetRulesSchema.safeParse({ version: 2, rules: [] }).success).toBe(false);
  });
  it('summarizes rules for agents', () => {
    const summary = describePacketRules(
      rules({
        id: 'team-size',
        kind: 'pattern',
        severity: 'error',
        documents: ['resume'],
        pattern: 'Led (\\d+) developers',
        equals: '3',
      }),
    );
    expect(summary).toContain('exact quotation');
    expect(summary).toContain(
      '- team-size (error) Resume: every match of /Led (\\d+) developers/ must capture "3".',
    );
    expect(describePacketRules(defaultPacketRules)).toContain(
      '- resume-length (error) Resume: at most 650 words.',
    );
  });
});

it('keeps the documented example valid and working', async () => {
  const docs = await readFile(new URL('../../../docs/packet-rules.md', import.meta.url), 'utf8');
  const example = [...docs.matchAll(/```json\n([\s\S]*?)```/g)].at(-1)![1];
  const file = packetRulesSchema.parse(JSON.parse(example));
  const resume = [
    '**Northwind Labs** | Senior Engineer | 2021 to 2024',
    '- Built React interfaces.',
    '- Led 4 developers',
    '**Contoso Studio** | Lead Engineer | 2018 to 2021',
  ].join('\n');
  const coverLetter =
    "Built React interfaces. I have not used Rust. I don't have Go. Drafted by AI.";
  expect(checkPacket({ ...packet, resume, coverLetter }, profile, file).findings).toEqual([
    expect.objectContaining({ ruleId: 'employer-headers', document: 'resume' }),
    expect.objectContaining({ ruleId: 'team-size', document: 'resume' }),
    expect.objectContaining({ ruleId: 'gap-sentences', document: 'coverLetter' }),
    expect.objectContaining({ ruleId: 'no-process-mentions', document: 'coverLetter' }),
  ]);
});
