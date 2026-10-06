import { ComposerContext } from './ComposerContext.tsx';
import type { ChatComposerProps } from '../types.ts';
import { PromptInputFooter } from '@/components/ai-elements/prompt-input/components/PromptInputFooter.tsx';
import { PromptInputSubmit } from '@/components/ai-elements/prompt-input/components/PromptInputSubmit.tsx';
import { Send } from 'lucide-react';

export function ComposerFooter(props: ChatComposerProps) {
  return (
    <PromptInputFooter className="chat-prompt-footer">
      <ComposerContext {...props} />
      <PromptInputSubmit
        className="button primary chat-send"
        aria-label="Send message"
        status={props.working ? 'submitted' : 'ready'}
        disabled={
          (!props.draft.trim() && !props.files.length) ||
          props.busy ||
          props.working ||
          !props.role.enabled ||
          !props.available
        }
      >
        <Send size={15} />
        <span>Send</span>
      </PromptInputSubmit>
    </PromptInputFooter>
  );
}
