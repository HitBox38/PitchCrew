import { JobActions } from '@/components/CardDetails/components/JobActions.tsx';
import { JobHeading } from '@/components/CardDetails/components/JobHeading.tsx';
import { JobMetadata } from '@/components/CardDetails/components/JobMetadata.tsx';
import { JobState } from '@/components/CardDetails/components/JobState.tsx';
import { JobTabs } from '@/components/CardDetails/components/JobTabs.tsx';
import { useCardDetails } from '@/components/CardDetails/hooks/useCardDetails.ts';
import type { CardDetailsProps } from '@/components/CardDetails/types.ts';
import { Modal } from '@/components/Modal/index.tsx';
import { Tabs } from '@/components/ui/tabs/components/Tabs.tsx';
import { TabsList } from '@/components/ui/tabs/components/TabsList.tsx';
import { TabsTrigger } from '@/components/ui/tabs/components/TabsTrigger.tsx';
import { runtimeLabels } from '@/lib/labels.ts';
import { FileCheck, FileText, History } from 'lucide-react';

export function CardDetails(props: CardDetailsProps) {
  const controller = useCardDetails(props);
  const { data, onClose, tab, setTab, run, failed, runRole } = controller;
  return (
    <Modal title="Job" onClose={onClose} drawer>
      <JobHeading {...controller} />
      <JobMetadata {...controller} />
      <JobState {...controller} />
      <JobActions {...controller} />
      {runRole ? (
        <p className="action-hint">
          Uses {runtimeLabels[data.roles.find((r) => r.id === runRole)!.runtime]}.{' '}
          {data.roles.find((r) => r.id === runRole)!.runtime === 'demo'
            ? 'No AI calls.'
            : 'Starting a run uses your CLI account.'}
        </p>
      ) : null}
      {failed && !run ? <p className="form-error">Last run: {failed.message}</p> : null}
      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList className="detail-tabs" aria-label="Job sections">
          {(['overview', 'packet', 'history'] as const).map((name) => (
            <TabsTrigger key={name} value={name}>
              {name === 'overview' ? (
                <FileText size={15} />
              ) : name === 'packet' ? (
                <FileCheck size={15} />
              ) : (
                <History size={15} />
              )}{' '}
              {name[0].toUpperCase() + name.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
        <JobTabs {...controller} />
      </Tabs>
    </Modal>
  );
}
