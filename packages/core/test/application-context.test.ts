import { expect, it } from 'vitest';
import { draftingCard } from '../src/application-context.ts';
import { cardInput, type Card } from '../src/cards.ts';

const card: Card = {
  ...cardInput.parse({ company: 'Fictional company', title: 'Engineer' }),
  id: 'revision-fixture',
  description: 'RAW-SOURCE',
  sourceHtml: '<p>RAW-SOURCE</p>',
  state: 'changes_requested',
  owner: null,
  fit: null,
  packet: { resume: 'Supported work.', coverLetter: '', formAnswers: '', note: '', claims: [] },
  feedback: ['Preserve the allowlist exception.'],
  packetContextRevision: 'confirmed',
  applicationContext: {
    brief: { companyContext: '', responsibilities: [], qualifications: [], constraints: [] },
    requirements: [],
    flagged: [{ text: 'HIDDEN-SOURCE', reason: 'Hidden directive.' }],
    sourceRevision: 'source',
    revision: 'confirmed',
    visibility: 'unknown',
    provenance: 'user',
    createdAt: '',
  },
  createdAt: '',
  updatedAt: '',
  sample: true,
};

it('carries revision feedback only with the matching draft and keeps source data excluded', () => {
  const revision = draftingCard(card, 'application-draft');
  expect(revision.packet).toEqual(card.packet);
  expect(revision.feedback).toEqual(card.feedback);
  expect(JSON.stringify(revision)).not.toContain('RAW-SOURCE');
  expect(JSON.stringify(revision)).not.toContain('HIDDEN-SOURCE');
  revision.feedback.push('Local change');
  expect(card.feedback).toHaveLength(1);
});

it('excludes old feedback from independent reviews, fit, first drafts and changed job contexts', () => {
  expect(draftingCard(card, 'application-review').feedback).toEqual([]);
  expect(draftingCard(card, 'fit').feedback).toEqual([]);
  expect(
    draftingCard(
      { ...card, applicationContext: undefined, packetContextRevision: undefined },
      'application-draft',
    ).feedback,
  ).toEqual([]);
  for (const input of [
    { ...card, packet: null },
    { ...card, packetContextRevision: 'old' },
  ]) {
    const draft = draftingCard(input, 'application-draft');
    expect(draft.packet).toBeNull();
    expect(draft.feedback).toEqual([]);
  }
});
