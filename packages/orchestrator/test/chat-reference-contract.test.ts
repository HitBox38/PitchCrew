import { expect, it } from 'vitest';
import { chatInput, type ChatReference } from '@pitchcrew/core';
import { referenceInputs } from '../../ui/src/ChatComposer/helpers.ts';

it('accepts composer and queued-edit reference payloads against the strict API contract', () => {
  const content = '  @career-coach use $interview\nthen explain.  ';
  const references: ChatReference[] = [
    {
      kind: 'agent',
      id: 'career-coach',
      token: '@career-coach',
      label: 'Career Coach',
      start: content.indexOf('@career-coach'),
      end: content.indexOf('@career-coach') + '@career-coach'.length,
    },
    {
      kind: 'skill',
      id: 'interview',
      token: '$interview',
      label: 'Interview preparation',
      revision: '2026-11-06T19:00:00Z',
      start: content.indexOf('$interview'),
      end: content.indexOf('$interview') + '$interview'.length,
    },
  ];
  const payload = { content, references: referenceInputs(content, references) };
  const parsed = chatInput.parse(payload);
  expect(parsed.content).toBe(content.trim());
  expect(parsed.content).toContain('\n');
  expect(parsed.references).toHaveLength(2);
  for (const reference of parsed.references!) {
    expect(reference).not.toHaveProperty('label');
    expect(parsed.content.slice(reference.start, reference.end)).toBe(reference.token);
  }
  expect(parsed.references?.[1]?.revision).toBe(references[1]!.revision);
});
