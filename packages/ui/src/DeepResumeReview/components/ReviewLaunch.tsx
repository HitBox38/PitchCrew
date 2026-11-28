import { useState } from 'react';
import { ScanSearch } from 'lucide-react';
import { cardLifecycle } from '@pitchcrew/core/lifecycles';
import { Button } from '@pitchcrew/design-system/button';
import type { ReviewLaunchProps } from '../types.ts';
import { ReviewSetup } from './ReviewSetup.tsx';
export const ReviewLaunch = (props: ReviewLaunchProps) => {
  const [open, setOpen] = useState(false);
  if (!cardLifecycle.is('deepReviewable', props.card.state)) return null;
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={props.disabled || props.working}
        onClick={() => setOpen(true)}
      >
        <ScanSearch size={15} />
        Deep review resume
      </Button>
      {open ? <ReviewSetup {...props} close={() => setOpen(false)} /> : null}
    </>
  );
};
