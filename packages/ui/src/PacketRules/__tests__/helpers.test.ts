import { expect, it } from 'vitest';
import {
  fileIssues,
  formatRules,
  issueText,
  issuesForRule,
  parseDraft,
  ruleSentence,
  ruleViews,
} from '../helpers.ts';

const draft = {
  version: 1,
  rules: [
    {
      id: 'resume-length',
      kind: 'word_limit',
      severity: 'error',
      documents: ['resume'],
      max: 650,
      count: 'all',
    },
    {
      id: 'team-size',
      kind: 'pattern',
      severity: 'warn',
      documents: ['resume', 'coverLetter'],
      pattern: 'Led (\\d+) developers',
      flags: 'i',
      equals: '3',
    },
    { kind: 'mystery' },
  ],
};

it('round-trips rules through the editor text and reports JSON errors', () => {
  const text = formatRules(draft);
  expect(parseDraft(text)).toEqual({ value: draft });
  expect(parseDraft('{"version": 1,')).toEqual({
    error: expect.stringContaining('This is not valid JSON.'),
  });
});

it('describes each draft rule, including incomplete ones', () => {
  expect(ruleViews(draft)).toEqual([
    {
      index: 0,
      id: 'resume-length',
      kind: 'Word limit',
      severity: 'error',
      documents: 'Resume',
      detail: 'At most 650 words.',
    },
    {
      index: 1,
      id: 'team-size',
      kind: 'Pattern',
      severity: 'warn',
      documents: 'Resume, Cover letter',
      detail: 'Every match of /Led (\\d+) developers/i must capture “3”.',
    },
    {
      index: 2,
      id: 'Rule 3',
      kind: 'Unknown kind',
      severity: 'unset',
      documents: 'No documents',
      detail: 'Unknown rule kind.',
    },
  ]);
  expect(ruleViews(null)).toEqual([]);
  expect(ruleViews({ rules: 'none' })).toEqual([]);
});

it('places validation issues next to their rule', () => {
  const issues = [
    { path: ['rules', 1, 'pattern'], message: 'Nested repeats are slow.' },
    { path: ['rules'], message: 'Too many patterns.' },
    { path: [], message: 'Too large.' },
  ];
  expect(issuesForRule(issues, 1).map(issueText)).toEqual(['pattern: Nested repeats are slow.']);
  expect(issuesForRule(issues, 0)).toEqual([]);
  expect(fileIssues(issues).map(issueText)).toEqual(['rules: Too many patterns.', 'Too large.']);
});

it('titles each rule by its documents and condition', () => {
  expect(draft.rules.map(ruleSentence)).toEqual([
    'Resume — at most 650 words',
    'Resume, Cover letter — /Led (\\d+) developers/i must capture “3”',
    'Rule — unknown rule kind',
  ]);
  expect(
    ruleSentence({ kind: 'max_bullets', documents: ['coverLetter'], max: 4, heading: 'x' }),
  ).toBe('Cover letter — at most 4 bullets per section');
  expect(ruleSentence({ kind: 'word_limit', documents: ['note'], max: 90 })).toBe(
    'Note — at most 90 body words',
  );
  expect(
    ruleSentence({
      kind: 'canonical_lines',
      documents: ['resume'],
      selector: '^Ph',
      values: ['a'],
    }),
  ).toBe('Resume — lines matching /^Ph/ use 1 listed value');
  expect(ruleSentence({ kind: 'pattern', documents: [], pattern: 'TODO', flags: '' })).toBe(
    'Pattern — no /TODO/',
  );
  expect(
    ruleSentence({ kind: 'pattern', documents: ['resume'], pattern: '!', flags: 'g', maxCount: 2 }),
  ).toBe('Resume — at most 2 of /!/g');
});

it('describes empty numeric drafts without leaking null or a made-up zero', () => {
  for (const kind of ['word_limit', 'max_bullets']) {
    const rule = { kind, max: null, documents: ['resume'] };
    expect(ruleSentence(rule)).toContain('needs a value');
    expect(ruleViews({ rules: [rule] })[0]?.detail).not.toContain('null');
  }
  expect(
    issueText({
      path: ['rules', 0, 'max'],
      message: 'Invalid input: expected number, received null',
    }),
  ).toBe('max: Enter a number.');
});

it('distinguishes missing limits from values that need correction', () => {
  for (const max of [0, 12.5, 200000]) {
    const rule = { kind: 'word_limit', max, documents: ['resume'] };
    expect(ruleSentence(rule)).toContain('needs correction');
    expect(ruleViews({ rules: [rule] })[0]?.detail).toContain('Correct the word limit');
  }
});
