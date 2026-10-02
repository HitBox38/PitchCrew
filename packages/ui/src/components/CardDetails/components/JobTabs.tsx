import { JobHistory } from '@/components/CardDetails/components/JobHistory.tsx';
import { JobOverview } from '@/components/CardDetails/components/JobOverview.tsx';
import { JobPacket } from '@/components/CardDetails/components/JobPacket.tsx';
import type { JobTabsProps } from '@/components/CardDetails/types.ts';
import { EmptyState } from '@/components/EmptyState/index.tsx';
import { TabsContent } from '@/components/ui/tabs/components/TabsContent.tsx';

export function JobTabs({
  tab,
  card,
  working,
  run,
  act,
  document,
  setDocument,
  data,
}: JobTabsProps) {
  return (
    <TabsContent className="detail-tab-content" value={tab}>
      {tab === 'overview' ? (
        <JobOverview card={card} working={working} run={run} act={act} />
      ) : tab === 'packet' ? (
        card.packet ? (
          <JobPacket document={document} setDocument={setDocument} card={card} />
        ) : (
          <EmptyState
            title="No packet yet"
            description="Shortlist this job, then run Writer to draft one."
          />
        )
      ) : (
        <JobHistory data={data} card={card} />
      )}
    </TabsContent>
  );
}
