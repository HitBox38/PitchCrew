import { ComposerInput } from './ComposerInput.tsx';
import { ComposerFooter } from './ComposerFooter.tsx';
import { ComposerContext } from './ComposerContext.tsx';
import { ComposerHint } from '@/ChatView/components/ComposerHint.tsx';
import type { ChatComposerProps } from '@/ChatView/types.ts';
import { PromptInput } from '@/components/ai-elements/prompt-input/components/PromptInput.tsx';
import { runtimeLabels } from '@/lib/labels.ts';

export function ChatComposer(props: ChatComposerProps) {
  const { role, available, error, send, working, addFiles } = props;
  const disabled = working || !available;
  return (
    <div className="chat-compose">
      {props.participants.length === 1 && (!role.enabled || !available) ? (
        <p className="form-error">
          {role.retiredAt
            ? `${role.name} is retired. Its conversation is kept for reference.`
            : !role.enabled
              ? `${role.name} is paused. Enable this role in its settings to chat.`
              : `${runtimeLabels[role.runtime]} is not available. Choose an installed runtime in role settings.`}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <PromptInput
        onSubmit={({ text }) => send(text, props.busy ? props.sendMode : 'queue')}
        className="chat-prompt"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault();
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          if (!disabled) addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <ComposerContext {...props} />
        <ComposerInput {...props} disabled={disabled} />
        <ComposerFooter {...props} />
      </PromptInput>
      <ComposerHint role={role} />
    </div>
  );
}
