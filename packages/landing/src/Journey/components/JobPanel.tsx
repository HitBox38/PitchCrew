import { FileCheck, FileText, History, X } from 'lucide-react';
import { useState } from 'react';
import { JobPanelFooter } from './JobPanelFooter';
import { JobHeading } from '@/components/CardDetails/components/JobHeading.tsx';
import { JobHistory } from '@/components/CardDetails/components/JobHistory.tsx';
import { JobMetadata } from '@/components/CardDetails/components/JobMetadata.tsx';
import { JobPacket } from '@/components/CardDetails/components/JobPacket.tsx';
import { JobState } from '@/components/CardDetails/components/JobState.tsx';
import { EmptyState } from '@/components/EmptyState/index.tsx';
import { Tabs } from '@/components/ui/tabs/components/Tabs.tsx';
import { TabsContent } from '@/components/ui/tabs/components/TabsContent.tsx';
import { TabsList } from '@/components/ui/tabs/components/TabsList.tsx';
import { TabsTrigger } from '@/components/ui/tabs/components/TabsTrigger.tsx';
import type { JourneyStage } from '../constants';
import { events, views } from '../demo/data';
import { useMounted } from '../hooks/useMounted';
import type { DemoSnapshot, DemoTab } from '../types';
import { JobBrief } from './JobBrief';

// The app's job details drawer, rebuilt from its own components with a fictional job.
export const JobPanel = ({
  stage,
  onAdvance,
}: {
  stage: JourneyStage['id'];
  onAdvance: () => void;
}) => {
  const view = views[stage];
  const [tab, setTab] = useState<DemoTab>(view.tab);
  const [document, setDocument] = useState(view.document);
  const mounted = useMounted();
  const act = () => onAdvance();
  return (
    <div className="card-details-panel job-demo">
      <div className="modal-heading flex items-center justify-between gap-4">
        <p className="job-demo-title">Job details</p>
        <X size={18} aria-hidden="true" />
      </div>
      <div className="job-summary px-5 pt-4 pb-3 max-mobile:px-4">
        <JobHeading card={view.card} />
        <JobMetadata card={view.card} />
        <JobState card={view.card} />
      </div>
      <Tabs
        className="job-sections gap-0"
        value={tab}
        onValueChange={(value) => setTab(value as DemoTab)}
      >
        <div className="detail-navigation px-5 pb-3 max-mobile:px-4">
          <TabsList variant="line" className="detail-tabs" aria-label="Job sections">
            {(['overview', 'packet', 'history'] as const).map((name) => {
              const Icon = icons[name];
              return (
                <TabsTrigger key={name} value={name}>
                  <Icon size={15} />{' '}
                  {{ overview: 'Job', packet: 'Application', history: 'Activity' }[name]}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        <TabsContent className="detail-tab-content px-5 pt-4 pb-6 max-mobile:px-4" value={tab}>
          {tab === 'overview' ? (
            <JobBrief />
          ) : tab === 'packet' ? (
            view.card.packet ? (
              <JobPacket document={document} setDocument={setDocument} card={view.card} />
            ) : (
              <EmptyState
                title="No packet yet"
                description="Writer hasn’t drafted one yet. Press Draft application below to see it."
              />
            )
          ) : mounted ? (
            <JobHistory
              data={{ events: events.filter((event) => event.id <= view.history) } as DemoSnapshot}
              card={view.card}
            />
          ) : null}
        </TabsContent>
      </Tabs>
      <JobPanelFooter stage={stage} advance={act} />
    </div>
  );
};

const icons = { overview: FileText, packet: FileCheck, history: History };
