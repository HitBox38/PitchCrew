import { TabsIndicator, TabsList, TabsTrigger } from '@pitchcrew/design-system/tabs';
import { GitBranch, MessageSquare } from 'lucide-react';

export const ConversationViewSwitch = ({ attention }: { attention: number }) => {
  return (
    <TabsList className="chat-view-switch" aria-label="Conversation view">
      <TabsTrigger value="conversation" aria-label="Conversation" title="Conversation">
        <MessageSquare size={14} /> <span className="chat-view-label">Conversation</span>
        <span className="chat-view-short-label" aria-hidden="true">
          Chat
        </span>
      </TabsTrigger>
      <TabsTrigger
        value="work"
        aria-label={`Crew work${attention ? `, ${attention} need attention` : ''}`}
        title={`Crew work${attention ? `, ${attention} need attention` : ''}`}
      >
        <GitBranch size={14} /> <span className="chat-view-label">Crew work</span>
        <span className="chat-view-short-label" aria-hidden="true">
          Work
        </span>
        {attention ? <span className="chat-count">{attention}</span> : null}
      </TabsTrigger>
      <TabsIndicator />
    </TabsList>
  );
};
