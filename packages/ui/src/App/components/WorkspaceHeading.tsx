import type { WorkspaceHeadingProps } from '@/App/types.ts';
import { viewTitles } from '@/AppSidebar/constants.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Plus, RefreshCw } from 'lucide-react';

export function WorkspaceHeading({
  view,
  summary,
  data,
  setAdd,
  working,
  checkRuntimes,
}: WorkspaceHeadingProps) {
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
      ) : view === 'crew' ? (
        <Button className="button" disabled={working} onClick={checkRuntimes}>
          <RefreshCw size={14} /> Check runtimes
        </Button>
      ) : null}
    </header>
  );
}
