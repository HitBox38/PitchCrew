import type { JobAgent } from '../types.ts';
import { turnPreview } from '../helpers.ts';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Tooltip } from '@/components/ui/tooltip/components/Tooltip.tsx';
import { TooltipTrigger } from '@/components/ui/tooltip/components/TooltipTrigger.tsx';
import { TooltipContent } from '@/components/ui/tooltip/components/TooltipContent.tsx';
import { TurnDuration } from '@/ChatTurn/components/TurnDuration.tsx';
import { Link } from '@tanstack/react-router';

export const JobAgents = ({
  agents,
  openChat,
}: {
  agents: JobAgent[];
  openChat: (thread: string, runId: string) => void;
}) => {
  return (
    <div
      className="detail-agents flex flex-wrap items-center gap-2"
      aria-label="Agents on this job"
    >
      {agents.map(({ run, name }) => {
        const preview = turnPreview(run);
        return (
          <Tooltip key={run.id}>
            <TooltipTrigger
              render={
                <Link
                  to="/chat/$thread"
                  params={{ thread: run.threadId ?? '' }}
                  search={{ run: run.id }}
                />
              }
              className="detail-agent"
              aria-label={`${name}: ${run.status === 'waiting' ? 'Waiting for you' : 'Running'}. Open job chat`}
              aria-disabled={!run.threadId}
              onClick={(event) => {
                if (!run.threadId) {
                  event.preventDefault();
                  return;
                }
                if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                  event.preventDefault();
                  openChat(run.threadId, run.id);
                }
              }}
            >
              <RoleAvatar agentRole={run.roleId} size="small" />
              <span>{name}</span>
              <span className="detail-agent-status">
                {run.status === 'waiting' ? 'Waiting for you' : 'Running'}
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="end"
              sideOffset={8}
              className="max-w-80 space-y-2 text-left [&_span]:text-inherit"
            >
              <div className="flex items-center justify-between gap-4">
                <strong>{name}</strong>
                <TurnDuration
                  startedAt={run.startedAt}
                  finishedAt={run.finishedAt}
                  active={run.status === 'running'}
                />
              </div>
              <p className="break-words">{preview.status}</p>
              {preview.commentary ? (
                <p className="line-clamp-5 break-words whitespace-pre-wrap">{preview.commentary}</p>
              ) : null}
              <p>Open job chat to see the full turn.</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};
