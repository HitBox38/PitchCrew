'use client';

import { Tabs } from '../components/ui/tabs';
import { JourneyLedger } from './components/JourneyLedger';
import { JourneyPanel } from './components/JourneyPanel';
import { stages } from './constants';
import { useJourney } from './hooks/useJourney';

export function Journey() {
  const { stage, selectStage, advance, changed } = useJourney();
  return (
    <Tabs
      className="journey"
      value={stage}
      onValueChange={selectStage}
      data-changed={changed ? '' : undefined}
    >
      <JourneyLedger stage={stage} />
      {stages.map((item) => (
        <JourneyPanel key={item.id} stage={item} onAdvance={advance} />
      ))}
    </Tabs>
  );
}
