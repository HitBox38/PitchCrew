import type { WorkspaceHeadingProps } from '@/App/types.ts';
import { viewTitles } from '@/AppSidebar/constants.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Plus } from 'lucide-react';

export function WorkspaceHeading({ view, summary, data, setAdd }: WorkspaceHeadingProps) {
  return (
    <header className="page-heading">
      <div>
        <h1>{view ? viewTitles[view] : 'Page not found'}</h1>
        <p>{summary}</p>
      </div>
      {view === 'board' && data.cards.length ? (
        <Button className="button primary" onClick={() => setAdd(true)}>
          <Plus size={16} /> Add job
        </Button>
      ) : null}
    </header>
  );
}
