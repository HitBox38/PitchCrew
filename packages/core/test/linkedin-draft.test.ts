import { expect, it } from 'vitest';
import { checkLinkedInDraft, linkedInFieldLimits } from '../src/linkedin-draft.ts';
import { baseSkills } from '../src/base-skills.ts';

it.each(Object.entries(linkedInFieldLimits))(
  'checks %s at and beyond its boundary',
  (field, max) => {
    const result = checkLinkedInDraft({
      fields: [
        { field, text: 'a'.repeat(max) },
        { field, text: 'a'.repeat(max + 1) },
      ],
    });
    expect(result.fields[0]).toMatchObject({ count: max, withinLimit: true, overBy: 0 });
    expect(result.fields[1]).toMatchObject({ count: max + 1, withinLimit: false, overBy: 1 });
    expect(result.fields[1].warnings).not.toEqual([]);
    expect(result.fields[0]).toMatchObject({ evidence: 'reported', reviewedAt: '2026-10-18' });
  },
);

it('measures untouched Unicode, spaces and newlines without disclosing text in its result', () => {
  const input = {
    fields: [
      { field: 'headline', text: ' 👩‍💻e\u0301\r\n ', label: 'Current role' },
      { field: 'about', text: '' },
      { field: 'about', text: ' \n' },
    ],
  };
  const original = structuredClone(input);
  const result = checkLinkedInDraft(input);
  expect(result.fields[0]).toMatchObject({ count: 11, codePoints: 9, label: 'Current role' });
  expect(result.fields[1]).toMatchObject({
    count: 0,
    warnings: [expect.stringContaining('Empty')],
  });
  expect(result.fields[2]).toMatchObject({
    count: 2,
    warnings: [expect.stringContaining('Empty')],
  });
  expect(result.counting).toContain('UTF-16');
  expect(result.caveat).toContain('live editor');
  expect(JSON.stringify(result)).not.toContain('👩');
  expect(input).toEqual(original);
});

it('counts the complete skills list without deduplication and explains its scope', () => {
  expect(checkLinkedInDraft({ skills: [] }).skills).toMatchObject({ count: 0, withinLimit: true });
  expect(checkLinkedInDraft({ skills: Array(100).fill('Python') }).skills).toMatchObject({
    count: 100,
    withinLimit: true,
    warnings: [expect.stringContaining('duplicate')],
  });
  expect(checkLinkedInDraft({ skills: Array(101).fill('Python') }).skills).toMatchObject({
    count: 101,
    withinLimit: false,
    overBy: 1,
    evidence: 'linkedin_help',
  });
  expect(checkLinkedInDraft({ skills: [' '] }).skills?.warnings).not.toEqual([]);
});

it.each([
  {},
  { fields: [] },
  { fields: [{ field: 'message', text: 'x' }] },
  { fields: [{ field: 'headline', text: 'x'.repeat(12001) }] },
  { fields: Array(31).fill({ field: 'headline', text: 'x' }) },
  { fields: [{ field: 'headline', text: 'x', publish: true }] },
  { skills: ['x'.repeat(201)] },
  { skills: Array(201).fill('x') },
  { skills: [''] },
  { skills: [], endpoint: 'https://example.invalid' },
])('rejects invalid or excessive input: %j', (input) => {
  expect(() => checkLinkedInDraft(input)).toThrow();
});

it('bundles the agreed assignments offline and fits the existing role content budget', () => {
  expect(baseSkills.find((skill) => skill.name === 'career-company-research')).toMatchObject({
    sourceType: 'bundled',
    defaultRoles: ['scout', 'career-coach'],
  });
  expect(baseSkills.find((skill) => skill.name === 'career-linkedin-drafting')).toMatchObject({
    sourceType: 'bundled',
    defaultRoles: ['career-coach'],
  });
  for (const role of ['scout', 'career-coach']) {
    const total = baseSkills
      .filter(
        (skill) =>
          skill.sourceType === 'bundled' &&
          (skill.defaultScope === 'all' || skill.defaultRoles.includes(role)),
      )
      .reduce(
        (sum, skill) =>
          sum +
          skill.name.length +
          skill.description.length +
          (skill.sourceType === 'bundled' ? skill.content.length : 0),
        0,
      );
    expect(total).toBeLessThanOrEqual(60000);
  }
});
