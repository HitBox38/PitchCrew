import { useMemo, type ReactNode } from 'react';
import { Conversation } from '@/components/ai-elements/conversation/components/Conversation.tsx';
import { transcriptItems } from '@/ChatTurn/helpers.ts';
import { ConversationContent } from '@/components/ai-elements/conversation/components/ConversationContent.tsx';
import { ConversationScrollButton } from '@/components/ai-elements/conversation/components/ConversationScrollButton.tsx';
import { useHistoryWindow } from '../hooks/useHistoryWindow.ts';
import { HISTORY_PAGE_SIZE } from '../history.ts';
import type { MessageTranscriptProps } from '../types.ts';
import { HistoryNavigation } from './HistoryNavigation.tsx';
import { MessageTranscript } from './MessageTranscript.tsx';

export function ConversationHistory({
  children,
  label,
  ...props
}: MessageTranscriptProps & { children: ReactNode; label: string }) {
  const items = useMemo(
    () => transcriptItems(props.messages, props.data.runs, props.thread),
    [props.messages, props.data.runs, props.thread],
  );
  const page = useHistoryWindow(items);
  return (
    <>
      {items.length > HISTORY_PAGE_SIZE ? (
        <HistoryNavigation page={page} total={items.length} />
      ) : null}
      <Conversation
        key={page.anchor ?? 'latest'}
        autoScroll={page.latest}
        defaultScrollPosition={page.latest ? 'end' : 'start'}
        className="chat-conversation flex min-h-0 flex-1 flex-col"
        aria-label={label}
      >
        <ConversationContent
          aria-label={label}
          className="chat-transcript"
          scrollClassName="min-h-0 flex-1"
        >
          {children}
          <MessageTranscript key={page.anchor ?? 'latest'} {...props} items={page.items} />
        </ConversationContent>
        {page.latest ? <ConversationScrollButton className="button chat-scroll" /> : null}
      </Conversation>
    </>
  );
}
