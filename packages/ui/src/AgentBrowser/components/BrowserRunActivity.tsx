import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';
import { ClaySteps } from '@/ChatTurn/components/ClaySteps.tsx';
import { runActivitySummary, shownBrowserRun } from '../layout.ts';
import type { AgentBrowserProps } from '../types.ts';
import { BrowserRunHeading } from './BrowserRunHeading.tsx';
import { browserActionPublic } from '@pitchcrew/core/browser-action-labels';

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
  // A waiting request is the run's state here too, in the chip's words.
  const pending = active
    ? data.computerApprovals.find((item) => item.runId === run.id && item.status === 'pending')
    : undefined;
  const approving = !!pending;
  const held = active && !!browserPanel.session?.manual && browserPanel.session.runId === run?.id;
  const { steps, commentary } = runActivitySummary(run?.activity ?? []);
  return (
    <section className="browser-run-activity" aria-label={`${role.name} activity`}>
      <BrowserRunHeading
        role={role}
        run={run}
        approving={approving}
        held={held}
        working={working}
        action={action}
      />
      <div className="browser-run-body">
        {/* During a run its latest update leads; once finished, the steps lead to the answer. */}
        {!reply && commentary?.text ? (
          <MessageResponse
            mode={commentary.status === 'running' ? 'streaming' : 'static'}
            components={noRemoteImages}
          >
            {commentary.text}
          </MessageResponse>
        ) : null}
        {steps.length ? (
          <ClaySteps
            entries={steps}
            blocked={pending ? browserActionPublic(pending.action, pending.page) : undefined}
          />
        ) : null}
        {reply ? (
          <MessageResponse mode="static" components={noRemoteImages}>
            {reply.content}
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
