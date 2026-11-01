import { TabsList, TabsTrigger } from '@pitchcrew/design-system/tabs';
import { GitBranch, MessageSquare } from 'lucide-react';

export const ConversationViewSwitch = ({ attention }: { attention: number }) => {
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
};
