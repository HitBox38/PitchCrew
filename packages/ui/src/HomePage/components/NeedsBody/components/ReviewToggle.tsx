import { Suspense, useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { retryableLazy } from '@/lib/retryable-lazy.ts';
import type { BodyProps } from '../../../types.ts';
import { OpenHeader } from './OpenHeader.tsx';

const ReviewBody = retryableLazy(() => import('./ReviewBody.tsx'), 'ReviewBody');

/**
 * A role or skill proposal: its summary and who proposed it, then Review change (or Review skill),
 * the row's glazed verb until it opens. Opening reads the exact change in place and decides
 * nothing; the verb steps down to a quiet Hide, the same control, so focus stays on it. The card
 * loads the first time it opens, so Home's first screen never waits for its Markdown renderer.
 */
export const ReviewToggle = ({ item, data }: BodyProps) => {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const noun = item.kind === 'skill-proposal' ? 'skill' : 'change';
  return (
    <>
      <OpenHeader item={item} data={data} />
      <Collapsible
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setLoaded(true);
        }}
        className="needs-review-disclosure"
      >
        <CollapsibleTrigger
          render={
            <Button
              variant={open ? 'ghost' : 'default'}
              className={open ? 'needs-review-toggle' : undefined}
            />
          }
        >
          {open ? `Hide ${noun}` : `Review ${noun}`}
        </CollapsibleTrigger>
        {open ? null : <p className="needs-gate">Reviewing it decides nothing.</p>}
        <CollapsibleContent keepMounted className="needs-review">
          {loaded ? (
            <Suspense fallback={<p className="needs-note">Loading the change…</p>}>
              <ReviewBody item={item} data={data} />
            </Suspense>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </>
  );
};
