import { useState } from 'react';
import type { Run } from '@pitchcrew/core';
import { Collapsible, CollapsibleContent } from '@pitchcrew/design-system/collapsible';
import { ActivityEntries } from './ActivityEntries.tsx';
import { activityPreview, activitySummary } from '../activity-summary.ts';
import { TurnActivityTrigger } from './TurnActivityTrigger.tsx';
import { useRunWait } from '../hooks/useRunWait.ts';
import { browserActionPublic } from '@pitchcrew/core/browser-action-labels';

/** One disclosure per turn; completed operational chatter yields to the answer. */
export const TurnActivity = ({ run }: { run: Run }) => {
  const [open, setOpen] = useState(false);
  const { waiting, approval } = useRunWait(run);
  const blocked = approval ? browserActionPublic(approval.action, approval.page) : undefined;
  const entries = run.activity ?? [];
  const summary = activitySummary(entries);
  if (!summary && !run.activityTruncated) return null;
  const preview = activityPreview(run, waiting);
  return (
    <div className="chat-turn-body ml-7.5" data-active={run.status === 'running' || undefined}>
      <Collapsible open={open} onOpenChange={setOpen} className="chat-turn-activity">
        <TurnActivityTrigger run={run} open={open} />
        <CollapsibleContent className="chat-turn-log">
          <ActivityEntries entries={entries} blocked={blocked} />
          {run.activityTruncated ? (
            <p className="text-detail text-muted-foreground">
              Activity is limited to 80 entries; some steps are omitted.
            </p>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
      {!open && preview.length ? (
        <div className="chat-turn-preview">
          <ActivityEntries entries={preview} />
        </div>
      ) : null}
    </div>
  );
};
