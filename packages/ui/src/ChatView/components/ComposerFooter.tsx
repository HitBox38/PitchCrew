import type { RefObject } from 'react';
import type { ComposerSuggestion } from '@/ChatComposer/types.ts';
import { BrowserModePicker } from '@/AgentBrowser/components/BrowserModePicker.tsx';
import { ComposerAttachmentMenu } from './ComposerAttachmentMenu.tsx';
import type { ChatComposerProps } from '../types.ts';
import { PromptInputFooter } from '@/components/ai-elements/prompt-input/components/PromptInputFooter.tsx';
import { ComposerSendActions } from './ComposerSendActions.tsx';

export const ComposerFooter = (
  props: ChatComposerProps & {
    contextActions: RefObject<((action: NonNullable<ComposerSuggestion['action']>) => void) | null>;
  },
) => {
  return (
    <PromptInputFooter
      className="chat-prompt-footer"
      data-follow-up={props.busy && (!!props.draft.trim() || !!props.files.length)}
    >
      <ComposerAttachmentMenu key={props.thread} {...props} />
      {props.role.capabilities?.computerUse ? (
        <BrowserModePicker
          role={props.browserPanel.roles.find((role) => role.id === props.role.id) ?? props.role}
          conversation={props.conversation}
          disabled={props.working}
          save={(patch) => void props.patchConversation(patch)}
        />
      ) : null}
      <ComposerSendActions {...props} />
    </PromptInputFooter>
  );
};
