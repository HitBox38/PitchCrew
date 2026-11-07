import type { Run } from '@pitchcrew/core';
import { runModel, turnStatus } from './helpers.ts';
import { TurnActivity } from './components/TurnActivity.tsx';
import { TurnDuration } from './components/TurnDuration.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { RunFailure } from './components/RunFailure.tsx';

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
  const answered = useWorkspaceStore((state) =>
    state.data?.userInputs?.some(
      (question) => question.runId === run.id && question.status === 'answered',
    ),
  );
  const handedOff = run.status === 'waiting' && answered;
  const { status } = turnStatus(run, replying);
  const hasActivity = !!run.activity?.length || run.activityTruncated;
  return (
    <section
      id={`run-${run.id}`}
      className="chat-turn scroll-mt-4"
      tabIndex={-1}
      aria-label={`${name} turn activity`}
    >
      <div className="chat-turn-heading text-detail text-muted-foreground">
        <RoleAvatar agentRole={run.roleId} size="small" />
        <div className="chat-turn-identity">
          <strong className="text-foreground" title={name}>
            {name}
          </strong>
          <span className="chat-turn-model" title={runModel(run, models)}>
            {runModel(run, models)}
          </span>
        </div>
        {!hasActivity ? (
          <div className="chat-turn-phase">
            <StatusBead status={handedOff ? 'queued' : run.status} />
            <span
              className="chat-turn-status min-w-0 truncate"
              title={handedOff ? 'Answer saved' : status}
            >
              {handedOff ? 'Answer saved' : status}
            </span>
            <TurnDuration
              runId={run.id}
              startedAt={run.startedAt}
              finishedAt={run.finishedAt}
              active={active}
            />
          </div>
        ) : null}
      </div>
      <TurnActivity run={run} />
      {run.status === 'failed' && run.message ? <RunFailure run={run} /> : null}
    </section>
  );
};
