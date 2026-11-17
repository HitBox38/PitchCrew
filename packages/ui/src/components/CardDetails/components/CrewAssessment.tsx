import { useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { keyedItems } from '@/lib/list-keys.ts';
import { leadNotes } from '../helpers.ts';

/**
 * Scout's read before drafting: the first note leads, the rest wait one click away, so the posting
 * stays near the top. Fit is advisory and never a hiring chance; the heading says so on hover.
 */
export const CrewAssessment = ({ notes }: { notes: string[] }) => {
  const [open, setOpen] = useState(false);
  const [first, ...rest] = leadNotes(notes);
  return (
    <section className="detail-assessment">
      <h3 title="Advisory · not a hiring chance">Crew assessment</h3>
      <p>{first}</p>
      {rest.length ? (
        <Collapsible open={open} onOpenChange={setOpen} className="grid gap-2">
          <CollapsibleContent>
            <ul className="feedback">
              {keyedItems(rest, (value) => value).map(({ item: note, key }) => (
                <li key={key}>{note}</li>
              ))}
            </ul>
          </CollapsibleContent>
          <CollapsibleTrigger
            render={<Button variant="ghost" size="sm" className="-ml-3 justify-self-start" />}
          >
            {open ? 'Fewer notes' : `All ${notes.length} notes`}
          </CollapsibleTrigger>
        </Collapsible>
      ) : null}
    </section>
  );
};
