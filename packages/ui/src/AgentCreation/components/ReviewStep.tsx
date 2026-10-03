import { Button } from '@/components/ui/button/components/Button.tsx';
import { setupWarnings } from '../helpers.ts';
import { reviewSections } from '../review.ts';
import type { StepProps, CreationController } from '../types.ts';

export function ReviewStep({ draft, data, goTo }: StepProps & Pick<CreationController, 'goTo'>) {
  const sections = reviewSections(draft, data);
  const warnings = setupWarnings(draft, data);
  return (
    <div className="flex flex-col gap-5">
      <p className="quiet">
        Review the agent’s responsibilities and access. Creating it saves its settings, skill
        assignments and optional routine together.
      </p>
      {sections.map((section, index) => (
        <section key={section.title} className="border-b border-border pb-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="font-semibold">{section.title}</h4>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => goTo(index)}
              aria-label={`Edit ${section.title.toLowerCase()}`}
            >
              Edit
            </Button>
          </div>
          <p className="text-sm break-words whitespace-pre-wrap">{section.text}</p>
        </section>
      ))}
      {warnings.length ? (
        <aside className="rounded-lg bg-muted p-4">
          <h4 className="mb-2 font-semibold">Before this agent starts work</h4>
          <ul className="list-disc space-y-2 pl-4 text-sm">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </aside>
      ) : null}
      <p className="quiet">
        Creating an agent grants only the access selected here. Profile and crew changes need
        review; browser interactions, submissions and exports need approval.
      </p>
    </div>
  );
}
