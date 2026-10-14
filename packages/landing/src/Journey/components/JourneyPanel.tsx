import { TabsContent } from '../../components/ui/tabs';
import type { JourneyStage } from '../constants';
import { JobPanel } from './JobPanel';

export function JourneyPanel({ stage, onAdvance }: { stage: JourneyStage; onAdvance: () => void }) {
  return (
    <TabsContent value={stage.id} className="journey-panel" data-role={stage.role}>
      <div className="journey-copy">
        <h2 className="journey-title">{stage.title}</h2>
        <p>{stage.summary}</p>
        <p className="journey-note">The app’s own components · fictional data</p>
      </div>
      <div className="journey-shot">
        <JobPanel stage={stage.id} onAdvance={onAdvance} />
      </div>
    </TabsContent>
  );
}
