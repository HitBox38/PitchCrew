import type { RefObject } from 'react';
import type { ComposerSuggestion } from '@/ChatComposer/types.ts';
import { ComposerAttachmentMenu } from './ComposerAttachmentMenu.tsx';
import type { ChatComposerProps } from '../types.ts';
import { PromptInputFooter } from '@/components/ai-elements/prompt-input/components/PromptInputFooter.tsx';
import { ComposerSendActions } from './ComposerSendActions.tsx';
import { ComposerRuntime } from './ComposerRuntime.tsx';
import { ComposerRecipient } from './ComposerRecipient.tsx';
import { ComposerOptions } from './ComposerOptions.tsx';
import { conversationQueue, queueNeedsResume } from '../queue-presentation.ts';
import { useStableCallbacks } from '@/lib/use-stable-callbacks.ts';

export const ComposerFooter = (
  props: ChatComposerProps & {
    contextActions: RefObject<((action: NonNullable<ComposerSuggestion['action']>) => void) | null>;
  },
) => {
  const stable = useStableCallbacks({ patchConversation: props.patchConversation });
  return (
    <PromptInputFooter
      className="chat-prompt-footer"
      data-follow-up={props.busy && (!!props.draft.trim() || !!props.files.length)}
      data-held={
        (!!props.retryMode ||
          (!props.busy &&
            (!!props.questions.length ||
              queueNeedsResume(
                conversationQueue(props.data.queue, props.thread, props.data.conversations),
              )))) &&
        (!!props.draft.trim() || !!props.files.length)
      }
      data-group={props.participants.length > 1 ? '' : undefined}
    >
      <div className="chat-composer-controls">
        <div className="chat-composer-routing">
          <ComposerRecipient {...props} />
        </div>
        <ComposerAttachmentMenu key={props.thread} {...props} />
        <ComposerRuntime {...props} />
        <ComposerOptions
          role={props.role}
          panelRole={props.browserPanel.roles.find((item) => item.id === props.role.id)}
          conversation={props.conversation}
          working={props.working}
          patchConversation={stable.patchConversation}
        />
      </div>
      <ComposerSendActions {...props} />
    </PromptInputFooter>
  );
};
