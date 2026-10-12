import { X } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { AgentBrowserProps } from '../types.ts';
export function BrowserPanelHeading({ browserPanel }: Pick<AgentBrowserProps, 'browserPanel'>) {
  return (
    <header className="browser-panel-heading">
      <div>
        <h2>{browserPanel.role!.name}’s browser</h2>
        <p>{browserPanel.session?.manual ? 'Manual control' : 'Local browser'}</p>
      </div>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Close browser panel"
        onClick={browserPanel.hide}
      >
        <X size={16} />
      </Button>
    </header>
  );
}
