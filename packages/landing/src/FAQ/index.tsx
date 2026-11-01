import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@pitchcrew/design-system/accordion';
import { questions } from './constants';

export const FAQ = () => {
  return (
    <section id="faq" className="section faq" aria-labelledby="faq-title">
      <div className="page-width faq-grid">
        <div className="faq-head">
          <h2 id="faq-title" className="headline">
            Questions, answered plainly.
          </h2>
          <p className="section-copy">
            What it costs, what it needs and what it never does on its own.
          </p>
        </div>
        <Accordion className="tray faq-list" defaultValue={[questions[0]!.question]}>
          {questions.map((item) => (
            <AccordionItem key={item.question} value={item.question} className="faq-item">
              <AccordionTrigger className="faq-trigger">{item.question}</AccordionTrigger>
              <AccordionContent className="faq-answer">
                <p>{item.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
