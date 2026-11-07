import type { Run } from '@pitchcrew/core';
import { ChevronRight } from 'lucide-react';
import { CollapsibleTrigger } from '@pitchcrew/design-system/collapsible';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { TurnDuration } from './TurnDuration.tsx';
import { activitySummary } from '../activity-summary.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

const outcomes = {
  completed: 'Worked',
  running: 'Working',
  waiting: 'Waiting for you',
  failed: 'Run failed',
  cancelled: 'Stopped',
};

export const TurnActivityTrigger = ({ run, open }: { run: Run; open: boolean }) => {
  const answered = useWorkspaceStore((state) =>
    state.data?.userInputs?.some(
      (question) => question.runId === run.id && question.status === 'answered',
    ),
  );
  const handedOff = run.status === 'waiting' && answered;
  const entries = run.activity ?? [];
  const failed = entries.some((entry) => entry.status === 'failed');
  return (
    <CollapsibleTrigger
      className="chat-turn-disclosure"
      data-status={handedOff ? 'queued' : run.status}
    >
      <ChevronRight size={14} aria-hidden="true" />
      <StatusBead status={handedOff ? 'queued' : run.status} />
      <span>{handedOff ? 'Answer saved' : outcomes[run.status]}</span>
      <TurnDuration
        runId={run.id}
        startedAt={run.startedAt}
        finishedAt={run.finishedAt}
        active={run.status === 'running'}
      />
      <span className="chat-turn-counts" data-failed={failed || undefined}>
        {activitySummary(entries)}
      </span>
      <span className="sr-only">{open ? 'Hide activity' : 'Show activity'}</span>
    </CollapsibleTrigger>
  );
};
