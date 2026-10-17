import { reviewAssessmentSchema, type ReviewAssessment, type RunResult } from '@pitchcrew/core';
import {
  originalReviewPerspectives,
  type ReviewPerspective,
} from '@pitchcrew/core/deep-review-labels';
export function assessmentFor(
  result: RunResult,
  resume: string,
  perspective?: ReviewPerspective,
  additionalPerspectives: ReviewPerspective[] = [],
): ReviewAssessment {
  if (result.role !== 'reviewer' || !result.assessment)
    throw new Error(
      'Reviewer did not return a structured deep-review assessment. Retry the review.',
    );
  const assessment = reviewAssessmentSchema.parse(result.assessment);
  const expected = perspective ? [perspective] : [...originalReviewPerspectives];
  if (
    assessment.perspectives.length !== expected.length ||
    expected.some((p) => !assessment.perspectives.some((item) => item.perspective === p))
  )
    throw new Error('Reviewer omitted or duplicated a required perspective.');
  for (const item of assessment.perspectives) {
    const verdicts =
      item.perspective === 'screen'
        ? ['PASS', 'REJECT']
        : item.perspective === 'interview'
          ? ['INTERVIEW', 'NO']
          : ['HIRE', 'MAYBE', 'PASS'];
    if (!verdicts.includes(item.verdict))
      throw new Error('Reviewer used a verdict that does not match its perspective.');
  }
  for (const item of assessment.perspectives)
    if (item.weakestLine && !resume.includes(item.weakestLine))
      throw new Error('Reviewer quoted a weakest line that is not in the resume.');
  for (const finding of assessment.findings) {
    if (!resume.includes(finding.quote) && !/^\[MISSING: [^\]\n]+\]$/.test(finding.quote))
      throw new Error('Reviewer quoted text that is not in the resume.');
    if (finding.perspectives.some((p) => ![...expected, ...additionalPerspectives].includes(p)))
      throw new Error('Review finding names an unreviewed perspective.');
  }
  const merged = new Map<string, ReviewAssessment['findings'][number]>();
  for (const finding of assessment.findings) {
    const key = `${finding.severity}:${finding.quote}:${finding.reason}`;
    const previous = merged.get(key);
    merged.set(key, {
      ...finding,
      perspectives: [...new Set([...(previous?.perspectives ?? []), ...finding.perspectives])],
    });
  }
  return {
    ...assessment,
    packetFeedback: result.feedback,
    suggestions: result.suggestions ?? [],
    findings: [...merged.values()].sort(
      (a, b) => Number(b.severity === 'blocking') - Number(a.severity === 'blocking'),
    ),
  };
}
