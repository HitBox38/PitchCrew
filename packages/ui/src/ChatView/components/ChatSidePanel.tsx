import { SidePanel } from '@/components/SidePanel/index.tsx';
import { SheetTitle } from '@/components/ui/sheet/components/SheetTitle.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function ChatSidePanel({
  title,
  children,
  onClose,
  className = '',
  returnFocus,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  returnFocus?: string;
}) {
  return (
    <SidePanel onClose={onClose} className={className} returnFocus={returnFocus}>
      <header className="chat-side-panel-heading">
        <SheetTitle>{title}</SheetTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close chat panel">
          <X size={18} />
        </Button>
      </header>
      <div className="chat-side-panel-body">{children}</div>
    </SidePanel>
  );
}
