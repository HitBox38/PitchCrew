import { WorkSection } from '@/ChatWork/components/WorkSection.tsx';
import { taskLabels } from '@/ChatWork/constants.ts';
import type { CrewTasksProps } from '@/ChatWork/types.ts';
import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { timeAgo } from '@/lib/time.ts';
import { Check, Clock3, GitBranch } from 'lucide-react';

export function CrewTasks({ tasks, data, name, onOpenCard, working, act }: CrewTasksProps) {
  return (
    <WorkSection className="chat-work-section">
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
    </WorkSection>
  );
}
