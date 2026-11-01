import { Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';

/** The Chats heading's Find chats and New conversation buttons. */
export const ChatsActions = ({
  finding,
  toggleFind,
  create,
}: {
  finding: boolean;
  toggleFind: () => void;
  create: () => void;
}) => (
  <div className="sidebar-category-actions">
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={finding ? 'Close Find chats' : 'Find chats'}
      aria-expanded={finding}
      title={finding ? 'Close Find chats' : 'Find chats'}
      onClick={toggleFind}
    >
      {finding ? <X aria-hidden="true" /> : <Search aria-hidden="true" />}
    </Button>
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label="New conversation"
      title="New conversation"
      onClick={create}
    >
      <Plus aria-hidden="true" />
    </Button>
  </div>
);
