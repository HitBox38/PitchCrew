import type { Run } from '@pitchcrew/core';
import { Check, CircleDashed, LoaderCircle, Square, X } from 'lucide-react';
import { activityGroups } from './helpers.ts';
import { ActivityGroup } from './components/ActivityGroup.tsx';
import { TurnDuration } from './components/TurnDuration.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';

export function ChatTurn({ run, name, replying }: { run: Run; name: string; replying: boolean }) {
  const active = run.status === 'running';
  const phase = run.activity?.findLast(
    (entry) => entry.status === 'running' && entry.kind !== 'commentary',
  );
  const status = active
    ? replying
      ? 'Replying…'
      : (phase?.label ?? (run.message || 'Working…'))
    : run.status === 'waiting'
      ? 'Waiting for you'
      : run.status === 'cancelled'
        ? 'Stopped'
        : run.status === 'failed'
          ? 'Failed'
          : 'Completed';
  const Icon = active
    ? LoaderCircle
    : run.status === 'failed'
      ? X
      : run.status === 'cancelled'
        ? Square
        : run.status === 'waiting'
          ? CircleDashed
          : Check;
  const groups = activityGroups(run.activity ?? []);
  return (
    <section
      id={`run-${run.id}`}
      className="chat-turn scroll-mt-4"
      tabIndex={-1}
      aria-label={`${name} turn activity`}
    >
      <div className="chat-turn-heading flex items-center gap-2 text-detail text-muted-foreground">
        <RoleAvatar agentRole={run.roleId} size="small" />
        <strong className="shrink-0 text-foreground">{name}</strong>
        <Icon size={13} className={active ? 'spin shrink-0' : 'shrink-0'} aria-hidden="true" />
        <output className="min-w-0 truncate">{status}</output>
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
        {run.activityTruncated ? (
          <p className="text-detail text-muted-foreground">
            Showing the first 80 activity entries.
          </p>
        ) : null}
      </div>
    </section>
  );
}
