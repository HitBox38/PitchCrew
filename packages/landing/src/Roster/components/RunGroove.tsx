import type { Agent, AgentState } from '../types';

/** This morning's groove: the run grows from its start as the agent works. */
export const RunGroove = ({ run, state }: { run: Agent['run']; state: AgentState }) => {
  const progress = state === 'idle' ? 0 : 1;
  return (
    <div className="agent-groove" aria-hidden="true">
      <div className="groove">
        {run ? (
          <span
            className="groove-run"
            style={{
              left: `${run.from * 100}%`,
              width: `${(run.to - run.from) * 100}%`,
              transform: `scaleX(${progress})`,
            }}
          />
        ) : null}
        <span className="groove-now" style={{ left: '91%' }} />
      </div>
      <div className="groove-labels">
        <span>9:00</span>
        <span>This morning</span>
        <span>9:30</span>
      </div>
    </div>
  );
};
