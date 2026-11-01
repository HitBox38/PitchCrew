'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { AgentCard } from './components/AgentCard';
import { WaitingTray } from './components/WaitingTray';
import { agents, order } from './constants';
import { useRehearsal } from './hooks/useRehearsal';
import type { AgentState } from './types';

export const Roster = () => {
  const { phase, playing, replay } = useRehearsal();
  const step = order[phase];
  const stateOf = (index: number): AgentState => {
    if (index === 3) return phase === 'done' ? 'done' : 'idle';
    if (step > index + 1) return 'done';
    if (step === index + 1) return 'working';
    return 'idle';
  };
  return (
    <section
      id="roster"
      className="roster page-width"
      aria-label="The crew working one fictional job"
      data-phase={phase}
    >
      <div className="roster-head">
        <h2 className="roster-title">
          Crew <span className="roster-count tabular">4 agents</span>
        </h2>
        <p className="roster-job">
          <span className="fictional">Fictional job</span> Forma · Design Engineer
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="roster-replay"
          onClick={replay}
          disabled={playing}
          aria-label="Replay the crew working the Forma job"
        >
          <RotateCcw aria-hidden="true" />
          Replay
        </Button>
      </div>
      <div className="tray roster-tray" data-ui="">
        <ul className="roster-grid">
          {agents.map((agent, index) => (
            <AgentCard key={agent.role} agent={agent} state={stateOf(index)} />
          ))}
        </ul>
        <WaitingTray open={phase === 'done'} />
      </div>
    </section>
  );
};
