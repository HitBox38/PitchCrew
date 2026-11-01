import { SidePanel } from '@/components/SidePanel/index.tsx';
import { SheetTitle } from '@/components/ui/sheet/components/SheetTitle.tsx';
import { SheetDescription } from '@/components/ui/sheet/components/SheetDescription.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

/** A docked chat panel with an identifying pebble and a one-line description. */
export const ChatSidePanel = ({
  title,
  children,
  onClose,
  className = '',
  returnFocus,
  icon,
  description,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  returnFocus?: string;
  icon?: ReactNode;
  description?: ReactNode;
}) => {
  return (
    <SidePanel onClose={onClose} className={className} returnFocus={returnFocus}>
      <header className="chat-side-panel-heading">
        {icon ? <span className="chat-side-panel-icon">{icon}</span> : null}
        <div className="chat-side-panel-titles">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close chat panel">
          <X size={18} />
        </Button>
      </header>
      <div className="chat-side-panel-body">{children}</div>
    </SidePanel>
  );
};
