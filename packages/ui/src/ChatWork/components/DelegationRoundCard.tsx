import type { DelegationRoundsProps } from '@/ChatWork/types.ts';
import { roundBead, roundLabel, roundMembers } from '@/ChatWork/rounds.ts';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Link } from '@tanstack/react-router';
import { Button } from '@pitchcrew/design-system/button';
import { taskLabels } from '@/lib/task-status.ts';
import { timeAgo } from '@/lib/time.ts';
import type { DelegationRound } from '@pitchcrew/core';

export const DelegationRoundCard = ({
  round,
  data,
  name,
  thread,
  working,
  act,
}: DelegationRoundsProps & { round: DelegationRound }) => {
  const members = roundMembers(round, data.tasks);
  const started = round.initiator === 'user' ? 'You' : name(round.initiator);
  return (
    <li className={`chat-round ${round.status}`}>
      <header className="chat-round-heading">
        <StatusBead status={roundBead(round, data.tasks)} />
        <div>
          <strong>
            {name(round.leadId)} asked {round.delegates.length}{' '}
            {round.delegates.length === 1 ? 'agent' : 'agents'}
          </strong>
          <span className="chat-round-meta">
            {roundLabel(round, data.tasks)} · started by {started} ·{' '}
            <time dateTime={round.createdAt}>{timeAgo(round.createdAt)}</time>
          </span>
        </div>
      </header>
      <ul className="chat-round-members">
        {members.map((member) => (
          <li key={member.key} className="chat-round-member" data-part={member.part}>
            <StatusBead status={member.status} />
            <RoleAvatar agentRole={member.roleId} size="small" />
            <div className="chat-round-member-body">
              <strong>
                {name(member.roleId)}
                <span>{member.part === 'collection' ? 'Collects the results' : 'Subtask'}</span>
              </strong>
              {member.part === 'delegate' && member.content ? (
                <p className="chat-round-subtask">{member.content}</p>
              ) : null}
              {member.error ? <p className="chat-round-error">{member.error}</p> : null}
            </div>
            <span className="chat-round-state">
              {member.part === 'collection' && member.status === 'queued'
                ? 'After delegates finish'
                : (taskLabels[member.status as keyof typeof taskLabels] ?? member.status)}
            </span>
            {member.threadId !== thread ? (
              <Link
                className="text-button"
                to="/chat/$thread"
                params={{ thread: member.threadId }}
                search={member.runId ? { run: member.runId } : undefined}
              >
                Open
              </Link>
            ) : null}
            {member.status === 'running' && member.runId ? (
              <Button
                className="text-button"
                disabled={working}
                onClick={() => act(`/runs/${member.runId}/cancel`)}
              >
                Stop
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </li>
  );
};
