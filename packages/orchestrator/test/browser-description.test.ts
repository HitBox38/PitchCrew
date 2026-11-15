import { expect, it } from 'vitest';
import fixture from './fixtures/job-boards/browser-posting.json';
import { browserJobDescription } from '../src/job-sources/browser-description.ts';

it('preserves every heading, paragraph and list item from the saved browser extraction', () => {
  const result = browserJobDescription(fixture.raw, fixture.raw);
  expect(result).toBe(fixture.readable);
  expect(result).not.toMatch(/heading .*\[level=|paragraph:|list:|listitem:/);
  expect(result.match(/^- /gm)).toHaveLength(18);
  // Check every source text node, including the final section, rather than just a preview.
  for (const line of fixture.raw.split('\n')) {
    const heading = /^\s*- heading "(.*)" \[level=2\]$/.exec(line);
    const text = /^\s*- (?:paragraph|listitem): (.*)$/.exec(line);
    if (heading) expect(result).toContain(`\n\n${heading[1]}\n\n`);
    if (text) expect(result).toContain(text[1]!.startsWith('"') ? JSON.parse(text[1]!) : text[1]);
  }
  expect(result.endsWith('Ada Lindqvist (Harbor Works).')).toBe(true);
});

it.each([
  'Build accessible products.\n\nRequirements\n- React\n- TypeScript',
  '# About us\n\nUse React & TypeScript.\n\n- Build UI\n- Ship it',
  '<h2>About us</h2><p>Original HTML</p>',
  'Write documentation for paragraph:, list: and listitem: extraction nodes.',
  'Quoted example:\n- paragraph: this is ordinary documentation',
])('leaves ordinary descriptions intact: %s', (description) => {
  expect(browserJobDescription(description, fixture.raw)).toBe(description);
});

it('decodes quoted source values without rewriting punctuation, Unicode or literal tokens', () => {
  const raw =
    '- heading "About \\"us\\"" [level=2]\n- paragraph: \'We say "hello": React & TypeScript—שלום. listitem: stays literal.\'\n- list:\n  - listitem: "Use C:\\\\tools and keep \\"quotes\\"."';
  expect(browserJobDescription(raw, raw)).toBe(
    'About "us"\n\nWe say "hello": React & TypeScript—שלום. listitem: stays literal.\n\n- Use C:\\tools and keep "quotes".',
  );
});

it.each([
  '- heading "About us" [level=2]\n- paragraph: "unterminated',
  '- heading "About us" [level=2]\n- button "Apply"',
  '- heading "About us" [level=2]\n- paragraph:\n  - link "Important original wording"',
  '- heading "About us" [level=2]\n- paragraph: &text Original wording\n- paragraph: *text',
  '- heading "About us" [level=2]\n- paragraph: Original wording # must not disappear',
  '- main:\n  - heading "About us" [level=2]\n  - paragraph: Original wording',
])('refuses ambiguous conversion without dropping text: %s', (raw) => {
  expect(() => browserJobDescription(raw, raw)).toThrow('could not be converted safely');
});

it('requires the actual inspected source for structural conversion', () => {
  expect(() => browserJobDescription(fixture.raw, 'A different posting')).toThrow(
    'could not be converted safely',
  );
});

it('converts an evidenced paragraph-only posting without requiring a heading', () => {
  const raw = '- paragraph: "Build accessible products: React & TypeScript."';
  expect(browserJobDescription(raw, raw)).toBe('Build accessible products: React & TypeScript.');
});

it('does not truncate long postings during conversion', () => {
  const paragraph = 'Full original wording. '.repeat(800);
  const raw = `- heading "About us" [level=2]\n- paragraph: ${JSON.stringify(paragraph)}`;
  expect(browserJobDescription(raw, raw)).toBe(`About us\n\n${paragraph}`);
});
