import { HistoryList } from './components/HistoryList.tsx';
import { HistorySheet } from './components/HistorySheet.tsx';
import { useInboxView } from './hooks/useInboxView.ts';
import type { InboxViewProps } from './types.ts';
import '@/styles/inbox.css';

/** Inbox history: past packet and browser decisions beside the one being read. */
export const InboxView = (props: InboxViewProps) => {
  const model = useInboxView(props);
  return (
    <section
      className="decision-history"
      aria-label="Inbox history"
      data-reading={model.selectedRequest ? '' : undefined}
    >
      <HistoryList {...model} />
      {model.selectedRequest ? (
        <HistorySheet {...model} request={model.selectedRequest} />
      ) : (
        <p className="decision-history-hint">
          {model.total
            ? 'Choose a past decision to see its files, the Reviewer’s summary and what happened next.'
            : 'Packets and browser actions you decide on land here, with their files and outcome.'}
        </p>
      )}
    </section>
  );
};
