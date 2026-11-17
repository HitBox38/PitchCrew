import type { ReactNode } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { ExtractionControls } from './ExtractionControls.tsx';
import type { useApplicationBrief } from '../hooks/useApplicationBrief.ts';
import type { Card } from '@pitchcrew/core';

/**
 * The brief's quiet tools in one row: edit it (or write it by hand), compare it with the posting,
 * and once a brief exists, extract it again. The dock holds the step's one glazed action. The
 * re-extraction Collapsible uses `display: contents`, so its panel wraps below the row while
 * Compare keeps the posting's own Collapsible.
 */
export const BriefTools = ({
  model,
  card,
  compare,
  dockWrites = false,
}: {
  model: ReturnType<typeof useApplicationBrief>;
  card: Card;
  compare?: ReactNode;
  /** The dock offers Write it myself, so the column doesn't repeat it. */
  dockWrites?: boolean;
}) => {
  const extracted = Boolean(model.loaded?.context);
  const again = extracted && model.available.length > 0;
  const edit = extracted || !dockWrites;
  if (!edit && !compare && !again) return null;
  return (
    <div className="detail-inline-actions">
      {edit ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={model.disabled}
          onClick={() => model.setEditing(true)}
        >
          {extracted ? 'Edit brief' : 'Write it myself'}
        </Button>
      ) : null}
      {compare}
      {again ? (
        <Collapsible className="contents">
          <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
            Extract again…
          </CollapsibleTrigger>
          <CollapsibleContent className="grid basis-full gap-2 pt-1 pl-3">
            <p className="quiet">
              An agent reads the saved posting again and prepares a new brief for you to confirm.
            </p>
            <ExtractionControls model={model} card={card} label="Extract again" />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
};
