import { TabsList } from '@/components/ui/tabs/components/TabsList.tsx';
import { TabsTrigger } from '@/components/ui/tabs/components/TabsTrigger.tsx';
import { GitBranch, MessageSquare } from 'lucide-react';

export function ConversationViewSwitch({ attention }: { attention: number }) {
  return (
    <TabsList className="chat-view-switch" aria-label="Conversation view">
      <TabsTrigger value="conversation">
        <MessageSquare size={14} /> Conversation
      </TabsTrigger>
      <TabsTrigger value="work">
        <GitBranch size={14} /> Crew work
        {attention ? <span className="chat-count">{attention}</span> : null}
      </TabsTrigger>
    </TabsList>
  );
}
