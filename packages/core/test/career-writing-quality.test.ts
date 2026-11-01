import { expect, it } from 'vitest';
import { applicationReview } from '../src/starter-skills/career-ops/application-review.ts';
import { applicationTailoring } from '../src/starter-skills/career-ops/application-tailoring.ts';

it('bundled tailoring guidance replaces generic copy without inventing motivations', () => {
  expect(applicationTailoring.content).toContain(
    'Interchangeable company praise, stock enthusiasm',
  );
  expect(applicationTailoring.content).toContain(
    'ask when the answer is required, omit and note when it is optional',
  );
  expect(applicationTailoring.content).toContain(
    'never change exact quotations, scope limits, dates, titles or qualifications',
  );
});
it('bundled review guidance keeps generic phrasing advisory unless a rule or required answer makes it blocking', () => {
  expect(applicationReview.content).toContain('optional style suggestion, not a blocker');
  expect(applicationReview.content).toContain(
    'required answer is addressed entirely with interchangeable copy',
  );
  expect(applicationReview.content).toContain(
    'Never ask Writer to invent motivations or experiences',
  );
});
