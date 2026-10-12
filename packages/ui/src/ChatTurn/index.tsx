import type { Run } from '@pitchcrew/core';
import { CircleDashed, LoaderCircle } from 'lucide-react';
import { activityGroups } from './helpers.ts';
import { ActivityGroup } from './components/ActivityGroup.tsx';
import { TurnDuration } from './components/TurnDuration.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';

export function ChatTurn({ run, name, replying }: { run: Run; name: string; replying: boolean }) {
  const active = run.status === 'running';
  const status = active
    ? replying
      ? 'Replying'
      : 'Working'
    : run.status === 'waiting'
      ? 'Waiting for you'
      : run.status === 'cancelled'
        ? 'Stopped'
        : run.status === 'failed'
          ? 'Failed'
          : 'Worked';
  const groups = activityGroups(run.activity ?? []);
  return (
    <section className="chat-turn" aria-label={`${name} turn activity`}>
      <div className="chat-turn-heading flex items-center gap-2 text-detail text-muted-foreground">
        <RoleAvatar agentRole={run.roleId} size="small" />
        <strong className="text-foreground">{name}</strong>
        {active ? (
          <LoaderCircle size={13} className="spin" aria-hidden="true" />
        ) : (
          <CircleDashed size={13} aria-hidden="true" />
        )}
        <output>{status}</output>
        <TurnDuration startedAt={run.startedAt} finishedAt={run.finishedAt} active={active} />
      </div>
      <div className="chat-turn-body ml-7.5 flex flex-col gap-3">
        {groups.map((group) =>
          group.kind === 'work' ? (
            <ActivityGroup key={group.id} entries={group.entries} />
          ) : (
            <div key={group.id} className="chat-turn-commentary">
              <MessageResponse
                mode={group.entries[0].status === 'running' ? 'streaming' : 'static'}
                components={noRemoteImages}
              >
                {group.entries[0].text}
              </MessageResponse>
            </div>
          ),
        )}
        {active && !groups.length ? (
          <p className="text-detail text-muted-foreground">
            {run.message === 'Preparing a reply…'
              ? run.message
              : 'Waiting for the agent’s next update…'}
          </p>
        ) : null}
        {run.activityTruncated ? (
          <p className="text-detail text-muted-foreground">
            Showing the first 80 activity entries.
          </p>
        ) : null}
      </div>
    </section>
  );
}
