import { useRef, useState, type UIEvent } from 'react';
import { JobOverview } from './JobOverview.tsx';
import { JobApplication } from './JobApplication.tsx';
import { JobActivity } from './JobActivity.tsx';
import type { JobTabsProps, JobSection } from '../types.ts';
import {
  Tabs,
  TabsIndicator,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@pitchcrew/design-system/tabs';
/**
 * Rendered attributes on the sheet (not :has) follow the reading column: `data-scrolled` shows the
 * sections' hairline; `data-condensed` lets phones fold the progress row away, with hysteresis so
 * a short page can never flicker between the two heights.
 */
const followScroll = (event: UIEvent<HTMLElement>) => {
  const content = event.currentTarget;
  const panel = content.closest('.card-details-panel');
  panel?.toggleAttribute('data-scrolled', content.scrollTop > 2);
  if (content.scrollTop > 32 && content.scrollHeight - content.clientHeight > 120)
    panel?.setAttribute('data-condensed', '');
  else if (content.scrollTop < 8) panel?.removeAttribute('data-condensed');
};

export const JobTabs = (model: JobTabsProps) => {
  const navigation = useRef<HTMLDivElement>(null);
  const [visited, setVisited] = useState<Set<JobSection>>(() => new Set([model.tab]));
  // Keep drafts and reading positions after a section is first opened.
  if (!visited.has(model.tab)) setVisited(new Set([...visited, model.tab]));
  return (
    <Tabs
      className="job-sections min-h-0 flex-1 gap-0"
      value={model.tab}
      onValueChange={(value) => {
        const panel = navigation.current?.closest('.card-details-panel');
        panel?.removeAttribute('data-scrolled');
        panel?.removeAttribute('data-condensed');
        model.setTab(value as JobSection);
      }}
    >
      <div className="detail-navigation shrink-0" ref={navigation}>
        <TabsList className="detail-tabs" aria-label="Job sections">
          {(Object.keys(sections) as JobSection[]).map((section) => (
            <TabsTrigger key={section} value={section}>
              {sections[section]}
            </TabsTrigger>
          ))}
          <TabsIndicator />
        </TabsList>
      </div>
      {(Object.keys(sections) as JobSection[]).map((section) => (
        <TabsContent
          key={section}
          value={section}
          keepMounted
          className="detail-tab-content min-h-0 overflow-y-auto"
          onScroll={followScroll}
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
