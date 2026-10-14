import { useMemo, type ReactNode } from 'react';
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
  ...props
}: MessageTranscriptProps & { children: ReactNode }) {
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
      <ConversationContent className="chat-transcript" scrollClassName="min-h-0 flex-1">
        {children}
        <MessageTranscript key={page.anchor ?? 'latest'} {...props} items={page.items} />
      </ConversationContent>
      {page.latest ? <ConversationScrollButton className="button chat-scroll" /> : null}
    </>
  );
}
