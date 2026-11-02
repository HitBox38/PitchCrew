import { expect, it } from 'vitest';
import { cardInput, jobLinkDetails, jobLinkImportInput } from '../src/index.ts';

const details = { company: 'Northwind Labs', title: 'Engineer' };

it('defers structural browser details to evidenced conversion while rejecting raw public-page details', () => {
  const input = {
    url: 'https://example.com/jobs/engineer',
    details: { ...details, description: '- heading "About us" [level=2]\n- paragraph: Build UI.' },
  };
  const publicPage = jobLinkImportInput.safeParse(input);
  expect(publicPage.success).toBe(false);
  if (!publicPage.success)
    expect(publicPage.error.issues[0]?.path).toEqual(['details', 'description']);
  expect(
    jobLinkImportInput.parse({ ...input, browserDigest: 'current-page' }).details,
  ).toMatchObject(input.details);
});

it.each([
  'Build accessible applications.',
  'About us\n\nWe build tools.\n\nThe role\n\n- React and TypeScript\n- Electron',
  '## The role\n\n- Build UI\n  - Support keyboard access\n\nKeep this final paragraph.',
  'Teach heading levels and paragraph: syntax, list: syntax, and listitem: roles.',
  'Write a paragraph:\n- Explain accessibility\n- Document listitem: behavior',
  'We call our product "heading" [level=2] in this example.',
])('preserves ordinary extracted descriptions exactly: %s', (description) => {
  expect(jobLinkDetails.parse({ ...details, description }).description).toBe(description);
});

it.each([
  'heading "About us" [level=2]\nparagraph: Original wording.',
  'Plain header\n  - heading "About us" [level=2]\n  - paragraph: Original wording.',
  '- paragraph: Original wording.\n- list:\n  - listitem: Build UI.',
  '- list:\n  - listitem: Build UI.',
  'list:\n  listitem: Build UI.',
  '- heading "The role" [level=2] [ref=e12]',
])(
  'rejects structural browser syntax without treating saved/manual text as extracted input',
  (description) => {
    expect(() => jobLinkDetails.parse({ ...details, description })).toThrow(
      'browser accessibility/extraction syntax',
    );
    expect(cardInput.parse({ ...details, description }).description).toBe(description);
  },
);
