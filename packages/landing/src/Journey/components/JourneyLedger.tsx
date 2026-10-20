import type { CSSProperties } from 'react';
import { TabsList, TabsTrigger } from '../../components/ui/tabs';
import { stages } from '../constants';
import { Opportunity } from './Opportunity';

export const JourneyLedger = ({ stage }: { stage: string }) => {
  const current = stages.findIndex((item) => item.id === stage);
  return (
    <div className="journey-ledger">
      <Opportunity />
      <TabsList
        className="journey-stages"
        aria-label="Follow one job through the crew"
        style={{ '--progress': current / (stages.length - 1) } as CSSProperties}
      >
        {stages.map(({ id, label, icon: Icon, role, description }, index) => (
          <TabsTrigger
            key={id}
            value={id}
            className="journey-stage"
            data-role={role}
            data-done={index < current ? '' : undefined}
          >
            <span className="journey-stage-icon">
              <Icon size={22} aria-hidden="true" />
            </span>
            <span className="journey-stage-label">{label}</span>
            <span className="journey-stage-description">{description}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      <p className="journey-approval">Exports and submissions wait for your approval.</p>
    </div>
  );
};
