import { DeepResumeReview } from '@/DeepResumeReview/index.tsx';
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
  setBriefDirty,
}: JobTabsProps) {
  return (
    <TabsContent
      className="detail-tab-content min-h-0 overflow-y-auto px-5 pt-4 pb-6 max-mobile:px-4"
      value={tab}
    >
      {tab === 'overview' ? (
        <JobOverview
          card={card}
          working={working}
          run={run}
          act={act}
          setBriefDirty={setBriefDirty}
        />
      ) : tab === 'packet' ? (
        card.packet ? (
          <JobPacket document={document} setDocument={setDocument} card={card} />
        ) : (
          <EmptyState
            title="No packet yet"
            description="Shortlist this job, then run Writer to draft one."
          />
        )
      ) : tab === 'reviews' ? (
        <DeepResumeReview key={card.id} card={card} data={data} />
      ) : (
        <JobHistory data={data} card={card} />
      )}
    </TabsContent>
  );
}
