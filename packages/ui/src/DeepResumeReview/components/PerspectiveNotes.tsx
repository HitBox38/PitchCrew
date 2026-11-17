import { keyedItems } from '@/lib/list-keys.ts';
import type { ReviewAssessment } from '@pitchcrew/core';

type Perspective = ReviewAssessment['perspectives'][number];

/** One perspective's reasoning: why, the weakest quoted line, and what an interviewer would ask. */
export const PerspectiveNotes = ({ item }: { item: Perspective }) => (
  <div className="grid gap-2">
    <p>{item.rationale}</p>
    {item.weakestLine ? <blockquote className="review-quote">{item.weakestLine}</blockquote> : null}
    {item.interviewQuestions.length ? (
      <ul className="feedback">
        {keyedItems(item.interviewQuestions, (value) => value).map(({ item: question, key }) => (
          <li key={key}>{question}</li>
        ))}
      </ul>
    ) : null}
  </div>
);
