import { useState } from 'react';
import { stages, type JourneyStage } from '../constants';

export const useJourney = () => {
  const [stage, setStage] = useState<JourneyStage['id']>('fit');
  const [changed, setChanged] = useState(false);
  const selectStage = (value: unknown) => {
    const selected = stages.find((item) => item.id === value);
    if (!selected) return;
    setStage(selected.id);
    setChanged(true);
  };
  const advance = () => {
    const next = stages[stages.findIndex((item) => item.id === stage) + 1];
    if (next) selectStage(next.id);
  };
  return { stage, selectStage, advance, changed };
};
