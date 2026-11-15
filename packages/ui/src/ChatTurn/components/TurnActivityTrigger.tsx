import { questionAnswered } from '@/lib/question-wait.ts';
import type { Run } from '@pitchcrew/core';
import { ChevronRight } from 'lucide-react';
import { CollapsibleTrigger } from '@pitchcrew/design-system/collapsible';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { TurnDuration } from './TurnDuration.tsx';
import { activitySummary } from '../activity-summary.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { browserActionPublic } from '@pitchcrew/core/browser-action-labels';
import { useRunWait } from '../hooks/useRunWait.ts';

const outcomes = {
  completed: 'Worked',
  running: 'Working',
  waiting: 'Waiting for you',
  failed: 'Run failed',
  cancelled: 'Stopped',
};

export const TurnActivityTrigger = ({ run, open }: { run: Run; open: boolean }) => {
  const answered = useWorkspaceStore((state) => questionAnswered(run.id, state.data?.userInputs));
  const handedOff = run.status === 'waiting' && answered;
  // Waiting on the user (a browser request, or a page they hold): the turn says so, not "Working".
  const { approval, held, waiting } = useRunWait(run);
  const status = handedOff ? 'queued' : waiting ? 'waiting' : run.status;
  const entries = run.activity ?? [];
  const failed = entries.some((entry) => entry.status === 'failed');
  const label = handedOff
    ? 'Answer saved'
    : approval
      ? 'Waiting for your OK'
      : held
        ? 'Paused · you have control'
        : outcomes[run.status];
  return (
    <CollapsibleTrigger className="chat-turn-disclosure" data-status={status}>
      <ChevronRight size={14} aria-hidden="true" />
      <StatusBead status={status} />
      <span>{label}</span>
      {approval ? (
        <span className="chat-turn-wait truncate">
          {browserActionPublic(approval.action, approval.page)}
        </span>
      ) : held ? null : (
        <TurnDuration
          runId={run.id}
          startedAt={run.startedAt}
          finishedAt={run.finishedAt}
          active={run.status === 'running'}
        />
      )}
      <span className="chat-turn-counts" data-failed={failed || undefined}>
        {activitySummary(entries)}
      </span>
      <span className="sr-only">{open ? 'Hide activity' : 'Show activity'}</span>
    </CollapsibleTrigger>
  );
};
