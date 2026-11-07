import { Square } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';
import { ClaySteps } from '@/ChatTurn/components/ClaySteps.tsx';
import { TurnDuration } from '@/ChatTurn/components/TurnDuration.tsx';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { runActivitySummary } from '../layout.ts';
import type { AgentBrowserProps } from '../types.ts';

/** Clay expanded browser: the browsing agent's public activity for the current run, with the
 * existing run cancellation. Private reasoning and tool inputs stay excluded as in chat. */
export const BrowserRunActivity = ({
  browserPanel,
  data,
  action,
  working,
}: Pick<AgentBrowserProps, 'browserPanel' | 'data' | 'action' | 'working'>) => {
  const role = browserPanel.role!;
  const runId = browserPanel.session?.runId;
  const run = runId ? data.runs.find((item) => item.id === runId) : undefined;
  const active = run?.status === 'running';
  const { steps, commentary } = runActivitySummary(run?.activity ?? []);
  return (
    <section className="browser-run-activity" aria-label={`${role.name} activity`}>
      <header className="browser-run-heading">
        <RoleAvatar agentRole={role.id} size="small" />
        <strong className="truncate">{role.name}</strong>
        {run ? <StatusBead status={run.status} /> : null}
        <span className="browser-run-state">
          {active ? 'working' : run ? run.status : 'No active turn'}
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
        {commentary?.text ? (
          <MessageResponse
            mode={commentary.status === 'running' ? 'streaming' : 'static'}
            components={noRemoteImages}
          >
            {commentary.text}
          </MessageResponse>
        ) : null}
        {!run ? (
          <p className="quiet">The agent’s steps appear here while it uses this browser.</p>
        ) : null}
      </div>
    </section>
  );
};
