import { Monitor } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { ChatViewModel } from '@/ChatView/types.ts';
export const BrowserButton = ({ browserPanel }: Pick<ChatViewModel, 'browserPanel'>) => {
  if (!browserPanel.available) return null;
  // The panel may be showing the packet; the button then switches to the page.
  const showing = browserPanel.open && browserPanel.view !== 'packet';
  return (
    <Button
      variant="ghost"
      size="sm"
      className="chat-browser"
      data-open={showing || undefined}
      aria-label={
        browserPanel.waiting
          ? 'Browser, waiting for your approval'
          : browserPanel.held
            ? 'Browser, agent paused while you have control'
            : browserPanel.activity
              ? 'Browser, agent working'
              : 'Browser'
      }
      aria-expanded={showing}
      aria-controls="agent-browser-panel"
      onClick={showing ? browserPanel.hide : browserPanel.show}
    >
      <Monitor size={14} />
      <span>Browser</span>
      {browserPanel.waiting || browserPanel.held || browserPanel.activity ? (
        <span
          className="clay-bead"
          data-size="sm"
          data-tone={browserPanel.waiting || browserPanel.held ? 'ochre' : 'plum'}
          aria-hidden="true"
        />
      ) : null}
    </Button>
  );
};
