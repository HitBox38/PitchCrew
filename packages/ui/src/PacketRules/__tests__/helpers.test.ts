import { expect, it } from 'vitest';
import {
  fileIssues,
  formatRules,
  issueText,
  issuesForRule,
  parseDraft,
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
