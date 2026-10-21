import type { ChatComposerProps } from '../types.ts';
import { PromptInputSubmit } from '@/components/ai-elements/prompt-input/components/PromptInputSubmit.tsx';
import { Send } from 'lucide-react';

export const ComposerSubmit = ({
  hasInput,
  ...props
}: ChatComposerProps & { hasInput: boolean }) => {
  const interruptLabel = props.busyElsewhere ? 'Stop current and send' : 'Interrupt and send';
  return (
    <PromptInputSubmit
      className="button primary chat-send"
      aria-label={props.busy && props.sendMode === 'queue' ? 'Queue follow-up' : 'Send message'}
      title={props.busy && props.sendMode === 'interrupt' ? interruptLabel : undefined}
      status={props.working ? 'submitted' : 'ready'}
      disabled={!hasInput || props.working || !props.available}
    >
      <Send size={15} />
      <span>Send</span>
    </PromptInputSubmit>
  );
};
