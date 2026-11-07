import { ChevronRight, Copy } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { copyText } from '@/lib/clipboard.ts';
import { browserErrorText } from '@pitchcrew/core/browser-errors';

/** Preserve exact provider diagnostics without making them the message's explanation. */
export const QueueDiagnostics = ({ entries }: { entries: { label: string; text: string }[] }) => {
  if (!entries.length) return null;
  return (
    <Collapsible className="chat-queue-diagnostics">
      <CollapsibleTrigger className="chat-queue-details-trigger">
        <ChevronRight size={13} aria-hidden="true" /> Details
      </CollapsibleTrigger>
      <CollapsibleContent>
        {entries.map((entry, index) => (
          <div key={index} className="chat-queue-diagnostic">
            <p>{entry.label}</p>
            <pre>{browserErrorText(entry.text)}</pre>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyText(browserErrorText(entry.text), 'Diagnostics copied')}
            >
              <Copy size={13} aria-hidden="true" /> Copy diagnostics
            </Button>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};
