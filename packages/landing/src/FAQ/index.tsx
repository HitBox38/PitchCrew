import { Plus } from 'lucide-react';
import { questions } from './constants';

export function FAQ() {
  return (
    <section id="faq" className="page-width section-space" aria-labelledby="faq-title">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
        <div>
          <h2 id="faq-title" className="section-title">
            A few things
            <br />
            you might be wondering.
          </h2>
          <p className="section-copy mt-6">The practical details, before you get started.</p>
        </div>
        <div className="border-t border-border">
          {questions.map(({ question, answer }) => (
            <details key={question} className="faq-item">
              <summary>
                <span>{question}</span>
                <Plus size={19} aria-hidden="true" />
              </summary>
              <p className="pr-7 pb-6 leading-relaxed text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
