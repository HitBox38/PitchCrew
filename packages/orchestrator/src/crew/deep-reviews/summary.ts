import type { DeepReview } from '@pitchcrew/core';
import { reviewPerspectives } from '@pitchcrew/core/deep-review-labels';
export const reviewSummaryMessage = (report: DeepReview) => {
  const assessment = report.after ?? report.before;
  const lines = [`**Deep resume review:** ${report.summary}`];
  if (assessment) {
    lines.push(
      ...assessment.perspectives.map(
        (p) =>
          `- ${reviewPerspectives[p.perspective]}: ${p.verdict} — ${p.rationale.slice(0, 180)}`,
      ),
    );
    const findings = (report.before ?? assessment).findings.slice(0, 5);
    if (findings.length)
      lines.push(
        '\n**Initial priority findings**',
        ...findings.map(
          (f, i) =>
            `${i + 1}. ${f.severity === 'blocking' ? 'Blocker' : 'Suggestion'}: ${f.reason.slice(0, 250)}`,
        ),
      );
    const before = report.before?.perspectives.find((p) => p.perspective === 'screen')?.verdict;
    const after = report.after?.perspectives.find((p) => p.perspective === 'screen')?.verdict;
    if (before || after)
      lines.push(
        `\nHeuristic screen: ${before ?? 'incomplete'} → ${after ?? 'incomplete'} (not an ATS test).`,
      );
  }
  lines.push(
    '\nOpen this job’s Deep reviews section for the full report and before/after resume. Export and submission require their existing approvals.',
  );
  return lines.join('\n');
};
