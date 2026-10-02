import { ChatComposer } from '@/ChatView/components/ChatComposer.tsx';
import { ChatProgress } from '@/ChatView/components/ChatProgress.tsx';
import { ConversationHeading } from '@/ChatView/components/ConversationHeading.tsx';
import { ConversationPanel } from '@/ChatView/components/ConversationPanel.tsx';
import { ConversationRail } from '@/ChatView/components/ConversationRail.tsx';
import { CrewWorkPanel } from '@/ChatView/components/CrewWorkPanel.tsx';
import { useChatView } from '@/ChatView/hooks/useChatView.ts';
import type { ChatViewProps } from '@/ChatView/types.ts';
import { Tabs } from '@/components/ui/tabs/components/Tabs.tsx';
import { TabsList } from '@/components/ui/tabs/components/TabsList.tsx';
import { TabsTrigger } from '@/components/ui/tabs/components/TabsTrigger.tsx';
import { GitBranch, MessageSquare } from 'lucide-react';

export function ChatView(props: ChatViewProps) {
  const controller = useChatView(props);
  const { thread, pane, setPane, running, attention } = controller;
  return (
    <section className={`chat-workspace ${thread}`} aria-label="Agent conversations">
      <ConversationRail {...controller} />
      <div className="chat-panel">
        <ConversationHeading {...controller} />
        <Tabs
          value={pane}
          onValueChange={(value) => setPane(value as 'conversation' | 'work')}
          className="chat-body-tabs"
        >
          <TabsList variant="line" className="chat-tabs" aria-label="Conversation view">
            <TabsTrigger value="conversation">
              <MessageSquare size={15} /> Conversation
            </TabsTrigger>
            <TabsTrigger value="work">
              <GitBranch size={15} /> Crew work
              {attention ? <span className="chat-count">{attention}</span> : null}
            </TabsTrigger>
          </TabsList>
          {pane === 'conversation' ? <ConversationPanel {...controller} /> : null}
          {pane === 'work' ? <CrewWorkPanel {...controller} /> : null}
        </Tabs>
        {running.length ? <ChatProgress {...controller} /> : null}
        <ChatComposer {...controller} />
      </div>
    </section>
  );
}
