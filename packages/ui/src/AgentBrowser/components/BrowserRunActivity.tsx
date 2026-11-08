import { Square } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';
import { ClaySteps } from '@/ChatTurn/components/ClaySteps.tsx';
import { TurnDuration } from '@/ChatTurn/components/TurnDuration.tsx';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { runActivitySummary, shownBrowserRun } from '../layout.ts';
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

/**
 * Clay expanded browser: the browsing agent's public activity for the run using the browser, or
 * its latest run here once that ends, with the existing run cancellation. Private reasoning and
 * tool inputs stay excluded as in chat.
 */
export const BrowserRunActivity = ({
  browserPanel,
  data,
  thread,
  action,
  working,
}: Pick<AgentBrowserProps, 'browserPanel' | 'data' | 'thread' | 'action' | 'working'>) => {
  const role = browserPanel.role!;
  const run = shownBrowserRun(data.runs, role.id, thread, browserPanel.session?.runId);
  // A finished run ends on its answer (the thread's latest message preview), not its plan.
  const reply =
    run && run.status !== 'running'
      ? data.messages.findLast((message) => message.runId === run.id && message.from === role.id)
      : undefined;
  const active = run?.status === 'running';
  const { steps, commentary } = runActivitySummary(run?.activity ?? []);
  return (
    <section className="browser-run-activity" aria-label={`${role.name} activity`}>
      <header className="browser-run-heading">
        <RoleAvatar agentRole={role.id} size="small" />
        <strong className="truncate">{role.name}</strong>
        {run ? <StatusBead status={run.status} /> : null}
        <span className="browser-run-state">
          {active ? 'Working' : run ? runStateLabels[run.status] : 'Idle'}
        </span>
        {run ? (
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
      <div className="browser-run-body">
        {steps.length ? <ClaySteps entries={steps} /> : null}
        {reply ? (
          <MessageResponse mode="static" components={noRemoteImages}>
            {reply.content}
          </MessageResponse>
        ) : commentary?.text ? (
          <MessageResponse
            mode={commentary.status === 'running' ? 'streaming' : 'static'}
            components={noRemoteImages}
          >
            {commentary.text}
          </MessageResponse>
        ) : null}
        {!run ? (
          <p className="quiet">
            {role.name}’s steps appear here while it uses this browser. Send a message below to give
            it a task.
          </p>
        ) : null}
      </div>
    </section>
  );
};
