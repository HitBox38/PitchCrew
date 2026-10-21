import { keyedItems } from '@/lib/list-keys.ts';
import type { ReviewAssessment } from '@pitchcrew/core';
import { reviewPerspectives } from '@pitchcrew/core/deep-review-labels';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion/index.tsx';
export const PerspectiveAssessment = ({
  assessment,
  title,
}: {
  assessment: ReviewAssessment;
  title: string;
}) => {
  return (
    <section className="grid gap-3" aria-label={title}>
      <h3>{title}</h3>
      <p>{assessment.summary}</p>
      {assessment.packetFeedback?.length ? (
        <ul className="list-disc pl-5">
          {keyedItems(assessment.packetFeedback, (value) => value).map(({ item: note, key }) => (
            <li key={key}>
              <strong>Packet blocker: </strong>
              {note}
            </li>
          ))}
        </ul>
      ) : null}
      {assessment.suggestions?.length ? (
        <ul className="list-disc pl-5">
          {keyedItems(assessment.suggestions, (value) => value).map(({ item: note, key }) => (
            <li key={key}>
              <strong>Suggestion: </strong>
              {note}
            </li>
          ))}
        </ul>
      ) : null}
      <Accordion multiple>
        {assessment.perspectives.map((item) => (
          <AccordionItem key={item.perspective} value={item.perspective}>
            <AccordionTrigger>
              <span>
                <strong>{reviewPerspectives[item.perspective]}</strong> · {item.verdict}
              </span>
            </AccordionTrigger>
            <AccordionContent keepMounted>
              <div className="mt-2 grid gap-2">
                <p>{item.rationale}</p>
                {item.weakestLine ? (
                  <blockquote className="border-l-2 border-border pl-3">
                    {item.weakestLine}
                  </blockquote>
                ) : null}
                {item.interviewQuestions.length ? (
                  <ul className="list-disc pl-5">
                    {keyedItems(item.interviewQuestions, (value) => value).map(
                      ({ item: question, key }) => (
                        <li key={key}>{question}</li>
                      ),
                    )}
                  </ul>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};
