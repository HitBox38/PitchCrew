import { ComposerAttachmentMenu } from './ComposerAttachmentMenu.tsx';
import type { ChatComposerProps } from '../types.ts';
import { PromptInputFooter } from '@/components/ai-elements/prompt-input/components/PromptInputFooter.tsx';
import { PromptInputSubmit } from '@/components/ai-elements/prompt-input/components/PromptInputSubmit.tsx';
import { ConversationSelect } from './ConversationSelect.tsx';
import { Send } from 'lucide-react';

export function ComposerFooter(props: ChatComposerProps) {
  const interruptLabel = props.busyElsewhere ? 'Stop current and send' : 'Interrupt and send';
  return (
    <PromptInputFooter className="chat-prompt-footer">
      <ComposerAttachmentMenu key={props.thread} {...props} />
      <div className="chat-send-actions">
        {props.busy ? (
          <ConversationSelect
            label="Follow-up action"
            value={props.sendMode}
            items={[
              { value: 'queue', label: 'Queue' },
              { value: 'interrupt', label: interruptLabel },
            ]}
            onChange={(value) => props.setSendMode(value as 'queue' | 'interrupt')}
          />
        ) : null}
        <PromptInputSubmit
          className="button primary chat-send"
          aria-label="Send message"
          title={props.busy && props.sendMode === 'interrupt' ? interruptLabel : undefined}
          status={props.working ? 'submitted' : 'ready'}
          disabled={
            (!props.draft.trim() && !props.files.length) || props.working || !props.available
          }
        >
          <Send size={15} />
          <span>{props.busy && props.sendMode === 'queue' ? 'Queue' : 'Send'}</span>
        </PromptInputSubmit>
      </div>
    </PromptInputFooter>
  );
}
