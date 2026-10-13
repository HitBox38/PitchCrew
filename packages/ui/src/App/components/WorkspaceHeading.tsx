import type { WorkspaceHeadingProps } from '@/App/types.ts';
import { viewIcons, viewTitles } from '@/AppSidebar/constants.ts';
import type { Ref } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ImportApplications } from '@/ImportApplications/index.tsx';
import { Plus } from 'lucide-react';

export function WorkspaceHeading({
  view,
  summary,
  data,
  setAdd,
  actionsRef,
}: WorkspaceHeadingProps & { actionsRef: Ref<HTMLDivElement> }) {
  const Icon = view ? viewIcons[view] : viewIcons.board;
  return (
    <header className="workspace-heading">
      <Icon size={18} className="workspace-heading-icon" aria-hidden="true" />
      <div className="workspace-heading-copy">
        <h1>{view ? viewTitles[view] : 'Page not found'}</h1>
        <p>{summary}</p>
      </div>
      <div className="workspace-heading-actions" ref={actionsRef}>
        {view === 'board' ? (
          <>
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
}
