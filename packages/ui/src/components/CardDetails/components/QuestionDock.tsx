import { useState } from 'react';
import type { UserInputRequest } from '@pitchcrew/core';
import { X } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { QuestionAnswerForm } from '@/UserQuestions/components/QuestionAnswerForm.tsx';
import { JobActionFooter } from './JobActionFooter.tsx';
import type { JobDock } from '../dock.ts';
import type { JobNextAction } from '../next-action.ts';
import type { CardDetailsModel } from '../types.ts';

/**
 * A waiting agent's question is answered in place with the chat's own question form (its draft is
 * shared with the chat), so answering never leaves the job. Job chat stays one click away.
 */
export const QuestionDock = ({
  model,
  next,
  dock,
  question,
}: {
  model: CardDetailsModel;
  next: JobNextAction;
  dock: JobDock;
  question: UserInputRequest;
}) => {
  const [open, setOpen] = useState(false);
  // While answering, the form carries the question; the dock keeps only what happens next.
  const shown = open ? { ...dock, line: '', tone: undefined } : dock;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="job-dock-root">
      <JobActionFooter
        dock={shown}
        panel={
          <CollapsibleContent className="job-dock-panel">
            {/* Folds the form away; Cancel question in the form is what ends the wait. */}
            <CollapsibleTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="job-dock-panel-close"
                  aria-label="Hide answer"
                />
              }
            >
              <X size={14} aria-hidden="true" />
            </CollapsibleTrigger>
            <QuestionAnswerForm
              question={question}
              action={model.action}
              working={model.working}
              active={open}
              onResolved={() => setOpen(false)}
            />
          </CollapsibleContent>
        }
      >
        {open ? null : (
          <>
            <Button variant="ghost" onClick={next.perform}>
              {next.label}
            </Button>
            <CollapsibleTrigger render={<Button />}>Answer here</CollapsibleTrigger>
          </>
        )}
      </JobActionFooter>
    </Collapsible>
  );
};
