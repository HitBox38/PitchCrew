import type { ChatComposerProps } from '../types.ts';
import { PromptInputHeader } from '@/components/ai-elements/prompt-input/components/PromptInputHeader.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { BriefcaseBusiness, LockKeyhole, X } from 'lucide-react';
import { ComposerAttachments } from './ComposerAttachments.tsx';

export function ComposerContext(props: ChatComposerProps) {
  const { attached, files, working, available, busy, messages, patchConversation, onOpenCard } =
    props;
  if (!attached && !files.length) return null;
  const jobLocked = busy || !!messages.length;
  return (
    <PromptInputHeader className="chat-composer-context">
      {attached ? (
        <div className="chat-context-chip chat-context-job">
          <Button
            variant="ghost"
            size="sm"
            className="min-w-0 flex-1 justify-start"
            onClick={() => onOpenCard(attached.id)}
            aria-label={`Open conversation job: ${attached.company} · ${attached.title}`}
            title={`${attached.company} · ${attached.title}`}
          >
            <BriefcaseBusiness size={14} />
            <span className="min-w-0 truncate">
              {attached.company} · {attached.title}
            </span>
          </Button>
          <span className="chat-context-kind">Conversation</span>
          {jobLocked ? (
            <LockKeyhole size={12} aria-label="Job fixed for this conversation" />
          ) : (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Remove conversation job"
              disabled={working}
              onClick={() => void patchConversation({ cardId: null })}
            >
              <X size={12} />
            </Button>
          )}
        </div>
      ) : null}
      <ComposerAttachments
        files={files}
        removeFile={props.removeFile}
        disabled={working || !available}
      />
    </PromptInputHeader>
  );
}
