import { useEffect, useRef, type ReactNode } from 'react';
import { Conversation } from '@/components/ai-elements/conversation/components/Conversation.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ConversationContent } from '@/components/ai-elements/conversation/components/ConversationContent.tsx';
import { ConversationScrollButton } from '@/components/ai-elements/conversation/components/ConversationScrollButton.tsx';
import { useConversationHistory } from '../hooks/useConversationHistory.ts';
import { HISTORY_PAGE_SIZE } from '../history.ts';
import type { MessageTranscriptProps } from '../types.ts';
import { HistoryNavigation } from './HistoryNavigation.tsx';
import { MessageTranscript } from './MessageTranscript.tsx';

export function ConversationHistory({
  children,
  label,
  ...props
}: MessageTranscriptProps & { children: ReactNode; label: string }) {
  const { page, total, loading, error, retry } = useConversationHistory(props);
  const focused = useRef(false);
  useEffect(() => {
    if (loading || !props.focusRunId || focused.current) return;
    const target = document.getElementById(`run-${props.focusRunId}`);
    if (!target) return;
    focused.current = true;
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  }, [loading, props.focusRunId, page.items]);
  if (loading)
    return error ? (
      <div role="alert">
        <p>{error}</p>
        <Button onClick={retry}>Retry</Button>
      </div>
    ) : (
      <output className="quiet p-4">Opening conversation…</output>
    );
  return (
    <>
      {total > HISTORY_PAGE_SIZE ? <HistoryNavigation page={page} total={total} /> : null}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <Button onClick={retry}>Retry</Button>
        </div>
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
