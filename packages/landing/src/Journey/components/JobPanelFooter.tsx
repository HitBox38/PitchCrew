import { JobActionFooter } from '@/components/CardDetails/components/JobActionFooter.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { JourneyStage } from '../constants';

export function JobPanelFooter({
  stage,
  advance,
}: {
  stage: JourneyStage['id'];
  advance: () => void;
}) {
  if (stage === 'track') return null;
  const labels = { fit: 'Draft application', draft: 'Review packet', review: 'Prepare export' };
  return (
    <JobActionFooter
      hint={
        <p className="action-hint">
          In this fictional example, the button moves to the next stage.
        </p>
      }
    >
      <Button onClick={advance}>{labels[stage]}</Button>
    </JobActionFooter>
  );
}
