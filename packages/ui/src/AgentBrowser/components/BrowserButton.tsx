import { Monitor } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { ChatViewModel } from '@/ChatView/types.ts';
export const BrowserButton = ({ browserPanel }: Pick<ChatViewModel, 'browserPanel'>) => {
  if (!browserPanel.available) return null;
  // The panel may be showing the packet; the button then switches to the page.
  const showing = browserPanel.open && browserPanel.view !== 'packet';
  return (
    <Button
      variant="outline"
      size="sm"
      className="chat-browser"
      aria-label={browserPanel.activity ? 'Browser, active' : 'Browser'}
      aria-expanded={showing}
      aria-controls="agent-browser-panel"
      onClick={showing ? browserPanel.hide : browserPanel.show}
    >
      <Monitor size={14} />
      <span>Browser</span>
      {browserPanel.activity ? (
        <span className="chat-role-dot working" aria-label="Browser active" />
      ) : null}
    </Button>
  );
};
