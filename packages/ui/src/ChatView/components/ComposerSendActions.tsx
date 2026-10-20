import type { ChatComposerProps } from '../types.ts';
import { ComposerStop } from './ComposerStop.tsx';
import { ConversationSelect } from './ConversationSelect.tsx';
import { PromptInputSubmit } from '@/components/ai-elements/prompt-input/components/PromptInputSubmit.tsx';
import { Send } from 'lucide-react';

export const ComposerSendActions = (props: ChatComposerProps) => {
  const hasInput = !!props.draft.trim() || !!props.files.length;
  const canStop = !!props.running.length;
  const interruptLabel = props.busyElsewhere ? 'Stop current and send' : 'Interrupt and send';
  return (
    <div className="chat-send-actions">
      {props.busy && hasInput ? (
        <ConversationSelect
          label="Follow-up action"
          disabled={props.working}
          value={props.sendMode}
          items={[
            { value: 'queue', label: 'After reply' },
            { value: 'interrupt', label: 'Interrupt' },
          ]}
          onChange={(value) => props.setSendMode(value as 'queue' | 'interrupt')}
        />
      ) : null}
      {canStop ? <ComposerStop {...props} /> : null}
      {!canStop || hasInput ? (
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
      ) : null}
    </div>
  );
};
