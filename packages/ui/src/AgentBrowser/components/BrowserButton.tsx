import { Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ChatViewModel } from '@/ChatView/types.ts';
export const BrowserButton = ({ browserPanel }: Pick<ChatViewModel, 'browserPanel'>) => {
  if (!browserPanel.available) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      className="chat-browser"
      aria-label={browserPanel.activity ? 'Browser, active' : 'Browser'}
      aria-expanded={browserPanel.open}
      aria-controls="agent-browser-panel"
      onClick={browserPanel.open ? browserPanel.hide : browserPanel.show}
    >
      <Monitor size={14} />
      <span>Browser</span>
      {browserPanel.activity ? (
        <span className="chat-role-dot working" aria-label="Browser active" />
      ) : null}
    </Button>
  );
};
