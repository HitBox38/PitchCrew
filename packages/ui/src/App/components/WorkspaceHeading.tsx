import type { WorkspaceHeadingProps } from '@/App/types.ts';
import { viewIcons, viewTitles } from '@/AppSidebar/constants.ts';
import type { Ref } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ImportApplications } from '@/ImportApplications/index.tsx';
import { Plus } from 'lucide-react';
import { Link, useSearch } from '@tanstack/react-router';
import { decisionSummary } from '@/ClayInterface/jobs.ts';

export const WorkspaceHeading = ({
  view,
  summary,
  data,
  setAdd,
  actionsRef,
}: WorkspaceHeadingProps & { actionsRef: Ref<HTMLDivElement> }) => {
  const Icon = view ? viewIcons[view] : viewIcons.board;
  const search: { view?: string } = useSearch({ strict: false });
  const history = view === 'inbox' && search.view === 'history';
  return (
    <header className="workspace-heading">
      <Icon size={18} className="workspace-heading-icon" aria-hidden="true" />
      <div className="workspace-heading-copy">
        <h1>{history ? 'Inbox history' : view ? viewTitles[view] : 'Page not found'}</h1>
        <p>
          {history
            ? 'Packets and browser actions you’ve decided on, with their files and outcomes.'
            : view === 'inbox'
              ? decisionSummary(data)
              : summary}
        </p>
      </div>
      <div className="workspace-heading-actions" ref={actionsRef}>
        {view === 'board' ? (
          <>
            <Button className="button" render={<Link to="/queue" />}>
              <viewIcons.queue size={16} aria-hidden="true" /> Queue
              {data.queue?.queues.length ? ` (${data.queue.queues.length})` : ''}
            </Button>
            <ImportApplications />
            {data.cards.length ? (
              <Button className="button primary" onClick={() => setAdd(true)}>
                <Plus size={16} /> Add job
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </header>
  );
};
