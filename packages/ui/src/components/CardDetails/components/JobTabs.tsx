import { useState } from 'react';
import { JobOverview } from './JobOverview.tsx';
import { JobApplication } from './JobApplication.tsx';
import { JobActivity } from './JobActivity.tsx';
import type { JobTabsProps, JobSection } from '../types.ts';
import { Tabs } from '@/components/ui/tabs/components/Tabs.tsx';
import { TabsList } from '@/components/ui/tabs/components/TabsList.tsx';
import { TabsTrigger } from '@/components/ui/tabs/components/TabsTrigger.tsx';
import { TabsContent } from '@/components/ui/tabs/components/TabsContent.tsx';
export const JobTabs = (model: JobTabsProps) => {
  const [visited, setVisited] = useState<Set<JobSection>>(() => new Set([model.tab]));
  // Keep drafts and reading positions after a section is first opened.
  if (!visited.has(model.tab)) setVisited(new Set([...visited, model.tab]));
  return (
    <Tabs
      className="job-sections min-h-0 flex-1 gap-0"
      value={model.tab}
      onValueChange={(value) => model.setTab(value as JobSection)}
    >
      <div className="detail-navigation shrink-0 px-5 max-mobile:px-4">
        <TabsList className="detail-tabs" aria-label="Job sections">
          {(Object.keys(sections) as JobSection[]).map((section) => (
            <TabsTrigger key={section} value={section}>
              {sections[section]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {(Object.keys(sections) as JobSection[]).map((section) => (
        <TabsContent
          key={section}
          value={section}
          keepMounted
          className="detail-tab-content min-h-0 overflow-y-auto px-5 py-5 max-mobile:px-4"
        >
          {visited.has(section) ? (
            section === 'job' ? (
              <JobOverview {...model} />
            ) : section === 'application' ? (
              <JobApplication {...model} />
            ) : (
              <JobActivity {...model} />
            )
          ) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
};

const sections = { job: 'Job', application: 'Application', activity: 'Activity' } as const;
