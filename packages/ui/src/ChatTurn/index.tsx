import type { Run } from '@pitchcrew/core';
import { activityGroups, runModel, turnStatus } from './helpers.ts';
import { ClaySteps } from './components/ClaySteps.tsx';
import { TurnDuration } from './components/TurnDuration.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export const ChatTurn = ({
  run,
  name,
  replying,
}: {
  run: Run;
  name: string;
  replying: boolean;
}) => {
  // The snapshot already carries each runtime's last loaded (or suggested) catalog; no fetch here.
  const models = useWorkspaceStore(
    (state) => state.data?.runtimes.find((item) => item.id === run.runtime)?.models,
  );
  const active = run.status === 'running';
  const { status } = turnStatus(run, replying);
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
        <span className="chat-turn-model">{runModel(run, models)}</span>
        <StatusBead status={run.status} />
        <output className="min-w-0 truncate">{status}</output>
        <TurnDuration startedAt={run.startedAt} finishedAt={run.finishedAt} active={active} />
      </div>
      <div className="chat-turn-body ml-7.5 flex flex-col gap-3">
        {groups.map((group) =>
          group.kind === 'work' ? (
            <ClaySteps key={group.id} entries={group.entries} />
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
};
