import type { Run } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@pitchcrew/design-system/collapsible';
import { ChevronRight, Copy } from 'lucide-react';
import { copyText } from '@/lib/clipboard.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useWriteMessage } from '@/UserQuestions/QuestionDockProvider.tsx';

/** A saved failure is a history record, not a fresh alert or another authorization to retry. */
export const RunFailure = ({ run }: { run: Run }) => {
  const writeMessage = useWriteMessage();
  const readOnly = useWorkspaceStore((state) => {
    const kind = state.data?.conversations?.find((item) => item.id === run.threadId)?.kind;
    return kind === 'agent_dm' || kind === 'history';
  });
  const restarted = run.message.startsWith('The daemon stopped during this run.');
  return (
    <div className="chat-turn-error">
      <p>
        {restarted ? 'This turn stopped when Pitchcrew restarted.' : 'This turn could not finish.'}
      </p>
      <div className="chat-turn-error-actions">
        {!readOnly && writeMessage ? (
          <Button variant="ghost" size="sm" onClick={writeMessage}>
            Write a follow-up
          </Button>
        ) : null}
        <Collapsible className="chat-turn-error-details">
          <CollapsibleTrigger className="chat-error-details-trigger">
            <ChevronRight size={13} aria-hidden="true" /> Diagnostics
          </CollapsibleTrigger>
          <CollapsibleContent className="chat-error-diagnostics">
            <pre>{run.message}</pre>
            <Button
              variant="ghost"
              size="sm"
              className="chat-diagnostics-copy"
              onClick={() => copyText(run.message, 'Diagnostics copied')}
            >
              <Copy size={13} aria-hidden="true" /> Copy diagnostics
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};
