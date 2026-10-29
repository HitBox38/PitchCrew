import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';

export const BrowserPopup = ({
  model,
  tabId,
  manual,
}: {
  model: NativeBrowserModel;
  tabId: string;
  manual: boolean;
}) => (
  <div className="browser-placeholder">
    <div className="browser-placeholder-content">
      <div className="browser-placeholder-icon" aria-hidden="true">
        <ExternalLink />
      </div>
      <div className="browser-placeholder-copy">
        <h3>Page open in a separate window</h3>
        <p>This window keeps the connection to the website that opened it for sign-in.</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={!manual}
        onClick={() => void model.command({ kind: 'select-tab', tabId })}
      >
        Show browser window <ExternalLink size={14} />
      </Button>
    </div>
  </div>
);
