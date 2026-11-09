import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { useState } from 'react';
import { useIsMobile } from '@pitchcrew/design-system/use-mobile';
import { keyedItems } from '@/lib/list-keys.ts';
import type { PacketHandoffData } from '../handoff.ts';

type Summary = NonNullable<PacketHandoffData['summary']>;

const HandoffList = ({ heading, items }: { heading: string; items: string[] }) =>
  items.length ? (
    <section className="packet-verdict-list">
      <h4>{heading}</h4>
      <ul>
        {keyedItems(items, (item) => item).map(({ item, key }) => (
          <li key={key}>{item}</li>
        ))}
      </ul>
    </section>
  ) : null;

const counted = (count: number, one: string, many = `${one}s`) =>
  count ? `${count} ${count === 1 ? one : many}` : '';

/**
 * The Reviewer's supporting bullets: open on wide screens, one tap away on phones. Controlled
 * from the first render, so the default follows the viewport until the user opens or closes it.
 */
export const VerdictNotes = ({ summary }: { summary: Summary }) => {
  const mobile = useIsMobile();
  const [chosen, setChosen] = useState<boolean | null>(null);
  const { nextSteps, highlights, limitations } = summary;
  if (!nextSteps.length && !highlights.length && !limitations.length) return null;
  const facts = [
    counted(nextSteps.length, 'next step'),
    counted(highlights.length, 'note'),
    counted(limitations.length, 'gap'),
  ].filter(Boolean);
  return (
    <Collapsible
      className="packet-verdict-notes"
      open={chosen ?? !mobile}
      onOpenChange={(open) => setChosen(open)}
    >
      <CollapsibleTrigger className="packet-verdict-toggle">
        Reviewer’s notes
        <ChevronDown size={15} aria-hidden="true" />
        <span>{facts.join(' · ')}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="packet-verdict-lists">
        <HandoffList heading="Gaps and limits" items={limitations} />
        <HandoffList heading="What to do next" items={nextSteps} />
        <HandoffList heading="Worth knowing" items={highlights} />
      </CollapsibleContent>
    </Collapsible>
  );
};
