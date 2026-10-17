import { useState } from 'react';
import { ScanSearch } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ReviewLaunchProps } from '../types.ts';
import { ReviewSetup } from './ReviewSetup.tsx';
export function ReviewLaunch(props: ReviewLaunchProps) {
  const [open, setOpen] = useState(false);
  const eligible = [
    'shortlisted',
    'changes_requested',
    'in_review',
    'agreed',
    'awaiting_approval',
  ].includes(props.card.state);
  if (!eligible) return null;
  return (
    <>
      <Button disabled={props.disabled || props.working} onClick={() => setOpen(true)}>
        <ScanSearch size={15} />
        Deep review resume
      </Button>
      {open ? <ReviewSetup {...props} close={() => setOpen(false)} /> : null}
    </>
  );
}
