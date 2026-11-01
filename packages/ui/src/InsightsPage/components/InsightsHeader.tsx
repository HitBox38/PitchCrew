import { WorkspaceHeaderFact, WorkspaceHeaderPrimary } from '@/App/components/WorkspacePage.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ApplicationInsights } from '@pitchcrew/core/insights';
import { Plus } from 'lucide-react';

/** Title-row fact (filtered and decided counts) and the page's one primary action. */
export const InsightsHeader = ({
  insights,
  create,
}: {
  insights: ApplicationInsights;
  create: () => void;
}) => {
  const { total } = insights;
  const decided = total - insights.outcomes.pending;
  return (
    <>
      <WorkspaceHeaderFact>
        {total} {total === 1 ? 'application' : 'applications'}, {decided} decided
      </WorkspaceHeaderFact>
      <WorkspaceHeaderPrimary>
        <Button className="button primary" onClick={create}>
          <Plus size={16} aria-hidden="true" /> Create a plan
        </Button>
      </WorkspaceHeaderPrimary>
    </>
  );
};
