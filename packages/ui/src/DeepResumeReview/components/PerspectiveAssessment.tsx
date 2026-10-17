import type { ReviewAssessment } from '@pitchcrew/core';
import { reviewPerspectives } from '@pitchcrew/core/deep-review-labels';
export function PerspectiveAssessment({
  assessment,
  title,
}: {
  assessment: ReviewAssessment;
  title: string;
}) {
  return (
    <section className="grid gap-3" aria-label={title}>
      <h3>{title}</h3>
      <p>{assessment.summary}</p>
      {assessment.packetFeedback?.length ? (
        <ul className="list-disc pl-5">
          {assessment.packetFeedback.map((note, index) => (
            <li key={index}>
              <strong>Packet blocker: </strong>
              {note}
            </li>
          ))}
        </ul>
      ) : null}
      {assessment.suggestions?.length ? (
        <ul className="list-disc pl-5">
          {assessment.suggestions.map((note, index) => (
            <li key={index}>
              <strong>Suggestion: </strong>
              {note}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="divide-y divide-border">
        {assessment.perspectives.map((item) => (
          <details key={item.perspective} className="py-3">
            <summary className="cursor-pointer">
              <strong>{reviewPerspectives[item.perspective]}</strong> · {item.verdict}
            </summary>
            <div className="mt-2 grid gap-2">
              <p>{item.rationale}</p>
              {item.weakestLine ? (
                <blockquote className="border-l-2 border-border pl-3">
                  {item.weakestLine}
                </blockquote>
              ) : null}
              {item.interviewQuestions.length ? (
                <ul className="list-disc pl-5">
                  {item.interviewQuestions.map((question, index) => (
                    <li key={index}>{question}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
