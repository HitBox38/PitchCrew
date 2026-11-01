import { Bead } from '../../components/clay/Bead';
import { Pebble } from '../../components/clay/Pebble';
import { RoleIcon } from '../../components/clay/RoleIcon';
import type { Agent, AgentState } from '../types';
import { RunGroove } from './RunGroove';

const beadTone = (state: AgentState) =>
  state === 'working' ? 'plum' : state === 'done' ? 'primary' : undefined;

export const AgentCard = ({ agent, state }: { agent: Agent; state: AgentState }) => {
  const status =
    state === 'working' ? agent.working : state === 'done' ? agent.finished : agent.idle;
  const tone = agent.run ? beadTone(state) : undefined;
  return (
    <li className="clay-card agent-card" data-role={agent.role} data-state={state}>
      <div className="agent-identity">
        <Pebble agent={agent.role} size={40}>
          <RoleIcon agent={agent.role} size={19} />
        </Pebble>
        <div className="min-w-0">
          <h3 className="agent-name">{agent.name}</h3>
          <p className="agent-runtime">{agent.runtime}</p>
        </div>
      </div>
      <p className="agent-capability">{agent.capability}</p>
      <RunGroove run={agent.run} state={state} />
      <p className="agent-status" aria-live="polite">
        <Bead tone={tone} live={state === 'working'} />
        <span key={status} className="agent-status-text">
          {status}
        </span>
      </p>
    </li>
  );
};
