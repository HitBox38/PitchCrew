import { useCardSource } from './hooks/useCardSource.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { JobSummary } from '@/components/CardDetails/components/JobSummary.tsx';
import { JobTabs } from '@/components/CardDetails/components/JobTabs.tsx';
import { useCardDetails } from '@/components/CardDetails/hooks/useCardDetails.ts';
import type { CardDetailsProps } from '@/components/CardDetails/types.ts';
import { Modal } from '@/components/Modal/index.tsx';
import { Tabs } from '@/components/ui/tabs/components/Tabs.tsx';
import { TabsList } from '@/components/ui/tabs/components/TabsList.tsx';
import { TabsTrigger } from '@/components/ui/tabs/components/TabsTrigger.tsx';
import { FileCheck, FileText, History } from 'lucide-react';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';

export function CardDetails(props: CardDetailsProps) {
  const source = useCardSource(props.card, props.data.workspace === true);
  if (!source.ready)
    return (
      <Modal title="Job details" onClose={props.onClose} drawer className="card-details-panel">
        {source.error ? (
          <div role="alert">
            <p>{source.error}</p>
            <Button onClick={source.retry}>Retry</Button>
          </div>
        ) : (
          <output>Opening job…</output>
        )}
      </Modal>
    );
  return (
    <CardDetailsContent
      {...props}
      card={source.card}
      sourceError={source.error}
      retrySource={source.retry}
    />
  );
}

function CardDetailsContent(
  props: CardDetailsProps & { sourceError: string; retrySource: () => void },
) {
  const controller = useCardDetails(props);
  const { onClose, tab, setTab } = controller;
  return (
    <Modal title="Job details" onClose={onClose} drawer className="card-details-panel">
      {props.sourceError ? (
        <div role="alert">
          <p>{props.sourceError}</p>
          <Button onClick={props.retrySource}>Retry</Button>
        </div>
      ) : null}
      <JobSummary {...controller} />
      <Tabs
        className="job-sections min-h-0 flex-1 gap-0"
        value={tab}
        onValueChange={(value) => setTab(value as typeof tab)}
      >
        <div className="detail-navigation shrink-0 px-5 pb-3 max-mobile:px-4">
          <TabsList className="detail-tabs" aria-label="Job sections">
            {(['overview', 'packet', 'reviews', 'history'] as const).map((name) => (
              <TabsTrigger key={name} value={name}>
                {name === 'overview' ? (
                  <FileText size={15} />
                ) : name === 'packet' || name === 'reviews' ? (
                  <FileCheck size={15} />
                ) : (
                  <History size={15} />
                )}{' '}
                {name[0].toUpperCase() + name.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <JobTabs {...controller} />
      </Tabs>
      <DiscardChanges guard={controller.guard} />
    </Modal>
  );
}
