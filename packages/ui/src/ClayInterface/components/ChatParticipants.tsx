import type { Run, Snapshot, UserInputRequest } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { participantStates } from '../helpers.ts';
import { StatusBead } from './StatusBead.tsx';
import { useBrowserPresenceField } from '@/DesktopBrowserHost/presence.ts';

const shown = 4;

/**
 * The conversation's agents as overlapping clay pebbles, each carrying a bead when it is working
 * here or waiting on the user, in the chat header.
 */
export const ChatParticipants = ({
  participants,
  running,
  questions,
  data,
}: {
  participants: string[];
  running: Run[];
  questions: UserInputRequest[];
  data: Snapshot;
}) => {
  // A browser request waiting on the user, or a page they hold, counts like a question: ochre.
  const heldRuns = useBrowserPresenceField('heldRuns');
  const approvals = data.computerApprovals.filter(
    (approval) => approval.status === 'pending' && running.some((run) => run.id === approval.runId),
  );
  const held = running.filter((run) => heldRuns.includes(run.id));
  const states = participantStates(participants, running, [...questions, ...approvals, ...held]);
  const name = (id: string) => data.roles.find((role) => role.id === id)?.name ?? id;
  const extra = states.length - shown;
  return (
    <span className="clay-participants" data-group={states.length > 1 ? '' : undefined}>
      {states.slice(0, extra > 0 ? shown - 1 : shown).map(({ id, status }) => (
        <span key={id} className="clay-participant" title={name(id)}>
          <RoleAvatar agentRole={id} size="normal" />
          {status ? (
            <StatusBead
              status={status}
              label={`${name(id)} ${status === 'running' ? 'is working' : 'is waiting for you'}`}
            />
          ) : null}
        </span>
      ))}
      {extra > 0 ? (
        <span className="clay-participant-more" aria-label={`${extra + 1} more agents`}>
          +{extra + 1}
        </span>
      ) : null}
    </span>
  );
};
