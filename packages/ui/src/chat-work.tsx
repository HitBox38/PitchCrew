import { Check, CircleCheck, Clock3, GitBranch, SlidersHorizontal, X } from 'lucide-react';
import type { AgentTask, Role, RoleProposal, SkillProposal, Snapshot } from '@pitchcrew/core';
import { capabilityLabels, capabilityDefaults } from './agent-capabilities.ts';
import { RoleAvatar, timeAgo } from './components.tsx';
import { Button } from './components/ui/button.tsx';
import { MessageResponse } from './components/ai-elements/message.tsx';
import type { ChatThread } from './chat-view.tsx';
import type { Action } from './App.tsx';

const noRemoteImages = { img: ({ alt }: { alt?: string }) => <span>{alt || 'Image'}</span> };
const taskLabels: Record<AgentTask['status'], string> = {
  queued: 'Queued',
  running: 'Working',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Stopped',
};
export function ChatWork({
  data,
  thread,
  role,
  proposals,
  skillProposals,
  tasks,
  action,
  working,
  onConfigure,
  onOpenCard,
}: {
  data: Snapshot;
  thread: ChatThread;
  role: Role;
  proposals: RoleProposal[];
  skillProposals: SkillProposal[];
  tasks: AgentTask[];
  action: Action;
  working: boolean;
  onConfigure: () => void;
  onOpenCard: (id: string) => void;
}) {
  const act = (path: string, body?: unknown) => {
    void action(path, 'POST', body).catch(() => {});
  };
  const name = (id: Role['id']) => data.roles.find((item) => item.id === id)?.name ?? id;
  return (
    <div className="chat-work-content">
      <section className="chat-work-section">
        <div className="chat-work-heading">
          <div>
            <h3>Proposed changes</h3>
            <p>Review how your agents want to work.</p>
          </div>
          {proposals.length ? <span className="chat-count">{proposals.length}</span> : null}
        </div>
        {proposals.length ? (
          proposals.map((proposal) => {
            const current = data.roles.find((item) => item.id === proposal.roleId)!;
            const active = data.runs.some(
              (run) => run.roleId === current.id && run.status === 'running',
            );
            return (
              <article
                className="chat-proposal"
                key={proposal.id}
                aria-label={`${current.name} proposed changes`}
              >
                <header>
                  <RoleAvatar agentRole={current.id} />
                  <div>
                    <h4>{current.name} wants to update its role</h4>
                    <time dateTime={proposal.createdAt}>{timeAgo(proposal.createdAt)}</time>
                  </div>
                  <span className="chat-review-label">Needs your review</span>
                </header>
                <MessageResponse mode="static" components={noRemoteImages}>
                  {proposal.reason}
                </MessageResponse>
                {proposal.changes.instructions !== undefined ? (
                  <details>
                    <summary>Compare role instructions</summary>
                    <div className="chat-instruction-comparison">
                      <div>
                        <h5>Current</h5>
                        <pre>{current.instructions || 'No custom instructions.'}</pre>
                      </div>
                      <div>
                        <h5>Proposed</h5>
                        <pre>{proposal.changes.instructions || 'No custom instructions.'}</pre>
                      </div>
                    </div>
                  </details>
                ) : null}
                {proposal.changes.capabilities ? (
                  <ul className="chat-capability-changes">
                    {Object.entries(proposal.changes.capabilities).map(([key, enabled]) => {
                      const before =
                        current.capabilities?.[key as keyof typeof capabilityLabels] ??
                        capabilityDefaults[key as keyof typeof capabilityLabels];
                      return (
                        <li key={key}>
                          <span>{capabilityLabels[key as keyof typeof capabilityLabels]}</span>
                          <span>
                            <span className="quiet">{before ? 'Enabled' : 'Disabled'}</span>
                            <span aria-hidden="true"> → </span>
                            <strong>{enabled ? 'Enabled' : 'Disabled'}</strong>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                <footer>
                  <p>
                    {active
                      ? `Available after ${current.name} finishes its run.`
                      : 'Applied changes take effect on the next run.'}
                  </p>
                  <div>
                    <Button
                      className="button"
                      disabled={working}
                      onClick={() => act(`/proposals/${proposal.id}/decide`, { approved: false })}
                    >
                      <X size={14} /> Decline
                    </Button>
                    <Button
                      className="button primary"
                      disabled={working || active}
                      onClick={() => act(`/proposals/${proposal.id}/decide`, { approved: true })}
                    >
                      <Check size={14} /> Apply changes
                    </Button>
                  </div>
                </footer>
              </article>
            );
          })
        ) : (
          <div className="chat-work-empty">
            <CircleCheck size={18} />
            <p>No changes waiting for your review.</p>
          </div>
        )}
      </section>
      <section className="chat-work-section">
        <div className="chat-work-heading">
          <div>
            <h3>Suggested skills</h3>
            <p>Review skills your agents recommend adding.</p>
          </div>
          {skillProposals.length ? (
            <span className="chat-count">{skillProposals.length}</span>
          ) : null}
        </div>
        {skillProposals.length ? (
          skillProposals.map((proposal) => (
            <article
              className="chat-proposal"
              key={proposal.id}
              aria-label={`${name(proposal.roleId)} suggested ${proposal.skill.name}`}
            >
              <header>
                <RoleAvatar agentRole={proposal.roleId} />
                <div>
                  <h4>{proposal.skill.name}</h4>
                  <time dateTime={proposal.createdAt}>
                    {name(proposal.roleId)} suggested {timeAgo(proposal.createdAt)}
                  </time>
                </div>
                <span className="chat-review-label">Needs your review</span>
              </header>
              <MessageResponse mode="static" components={noRemoteImages}>
                {proposal.reason}
              </MessageResponse>
              {proposal.skill.description ? <p>{proposal.skill.description}</p> : null}
              <p className="quiet">
                Assigned to:{' '}
                {proposal.skill.scope === 'all'
                  ? 'All agents'
                  : proposal.skill.roleIds.map(name).join(', ')}
              </p>
              {proposal.skill.source ? (
                <p className="quiet skill-source">
                  From {proposal.skill.source.url}
                  <br />
                  Only Markdown instructions are included.
                </p>
              ) : null}
              <details>
                <summary>Review skill instructions</summary>
                <pre className="suggested-skill-content">{proposal.skill.content}</pre>
              </details>
              <footer>
                <p>Applies to new runs after you add it.</p>
                <div>
                  <Button
                    className="button"
                    disabled={working}
                    onClick={() =>
                      act(`/skill-proposals/${proposal.id}/decide`, { approved: false })
                    }
                  >
                    <X size={14} /> Decline
                  </Button>
                  <Button
                    className="button primary"
                    disabled={working}
                    onClick={() =>
                      act(`/skill-proposals/${proposal.id}/decide`, { approved: true })
                    }
                  >
                    <Check size={14} /> Add skill
                  </Button>
                </div>
              </footer>
            </article>
          ))
        ) : (
          <div className="chat-work-empty">
            <CircleCheck size={18} />
            <p>No skills waiting for your review. Ask an agent to suggest one.</p>
          </div>
        )}
      </section>
      <section className="chat-work-section">
        <div className="chat-work-heading">
          <div>
            <h3>Crew follow-ups</h3>
            <p>See what the crew has queued and completed.</p>
          </div>
          <GitBranch size={18} />
        </div>
        {tasks.length ? (
          <ol className="chat-task-list">
            {tasks.map((task) => {
              const job = data.cards.find((card) => card.id === task.cardId);
              return (
                <li className={`chat-task ${task.status}`} key={task.id}>
                  <span className="chat-task-marker" aria-hidden="true">
                    {task.status === 'completed' ? <Check size={12} /> : <Clock3 size={12} />}
                  </span>
                  <div>
                    <header>
                      <strong>
                        {name(task.roleId)}
                        <span>{task.mode === 'chat' ? 'Conversation' : 'Job workflow'}</span>
                      </strong>
                      <span className="chat-task-status">{taskLabels[task.status]}</span>
                    </header>
                    <MessageResponse mode="static" components={noRemoteImages}>
                      {task.error || task.content}
                    </MessageResponse>
                    <footer>
                      {job ? (
                        <Button
                          variant="ghost"
                          className="chat-job-link"
                          onClick={() => onOpenCard(job.id)}
                        >
                          {job.company} · {job.title}
                        </Button>
                      ) : (
                        <time dateTime={task.createdAt}>{timeAgo(task.createdAt)}</time>
                      )}
                      {task.status === 'running' && task.runId ? (
                        <Button
                          className="text-button"
                          disabled={working}
                          onClick={() => act(`/runs/${task.runId}/cancel`)}
                        >
                          Stop run
                        </Button>
                      ) : null}
                    </footer>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="chat-work-empty">
            <GitBranch size={18} />
            <p>When an agent asks the crew to continue its work, the follow-up appears here.</p>
          </div>
        )}
      </section>
      {thread !== 'crew' ? (
        <section className="chat-work-section chat-role-summary">
          <div className="chat-work-heading">
            <div>
              <h3>How {role.name} works</h3>
              <p>Capabilities you’ve enabled for this role.</p>
            </div>
            <Button className="text-button" onClick={onConfigure}>
              <SlidersHorizontal size={14} /> Edit
            </Button>
          </div>
          <ul>
            {Object.entries(capabilityLabels).map(([key, label]) => {
              const enabled =
                role.capabilities?.[key as keyof typeof capabilityLabels] ??
                capabilityDefaults[key as keyof typeof capabilityLabels];
              return (
                <li key={key}>
                  <span>{label}</span>
                  <span className={enabled ? 'enabled' : ''}>
                    {enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="chat-approval-note">
            Agents propose instruction and capability changes and suggest skills. You decide whether
            to apply them.
          </p>
        </section>
      ) : null}
    </div>
  );
}
