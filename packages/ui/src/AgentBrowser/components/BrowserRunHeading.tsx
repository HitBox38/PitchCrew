import type { Role, Run } from '@pitchcrew/core';
import { Square } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { TurnDuration } from '@/ChatTurn/components/TurnDuration.tsx';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import type { AgentBrowserProps } from '../types.ts';

/** Run states in the panel's words; the chip says Idle for no run. */
const runStateLabels: Record<string, string> = {
  running: 'Working',
  completed: 'Done',
  failed: 'Failed',
  cancelled: 'Stopped',
  waiting: 'Waiting for your answer',
  interrupted: 'Interrupted',
  queued: 'Queued',
};

/** The expanded column's run line: who, its state in the chip's words, time and Stop. */
export const BrowserRunHeading = ({
  role,
  run,
  approving,
  held,
  working,
  action,
}: Pick<AgentBrowserProps, 'action' | 'working'> & {
  role: Role;
  run: Run | undefined;
  approving: boolean;
  /** The user holds the page the run uses: it is paused for them, not working. */
  held: boolean;
}) => {
  const active = run?.status === 'running';
  return (
    <header className="browser-run-heading">
      <RoleAvatar agentRole={role.id} size="small" />
      <strong className="truncate">{role.name}</strong>
      {run ? <StatusBead status={approving || held ? 'waiting' : run.status} /> : null}
      <span className="browser-run-state">
        {approving
          ? 'Needs your OK'
          : held
            ? 'Paused · you have control'
            : active
              ? 'Working'
              : run
                ? runStateLabels[run.status]
                : 'Idle'}
      </span>
      {run && !approving && !held ? (
        <TurnDuration
          runId={run.id}
          startedAt={run.startedAt}
          finishedAt={run.finishedAt}
          active={active}
        />
      ) : null}
      {active ? (
        <Button
          size="sm"
          variant="ghost"
          className="browser-run-stop"
          disabled={working}
          onClick={() => void action(`/runs/${run.id}/cancel`, 'POST').catch(() => {})}
        >
          <Square size={12} aria-hidden="true" /> Stop
        </Button>
      ) : null}
    </header>
  );
};
