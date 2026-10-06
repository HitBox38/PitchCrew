import { ComposerReasoning } from './ComposerReasoning.tsx';
import { ComposerFooter } from './ComposerFooter.tsx';
import { ComposerAttachments } from './ComposerAttachments.tsx';
import { ComposerHint } from '@/ChatView/components/ComposerHint.tsx';
import type { ChatComposerProps } from '@/ChatView/types.ts';
import { PromptInput } from '@/components/ai-elements/prompt-input/components/PromptInput.tsx';
import { PromptInputBody } from '@/components/ai-elements/prompt-input/components/PromptInputBody.tsx';
import { PromptInputTextarea } from '@/components/ai-elements/prompt-input/components/PromptInputTextarea.tsx';
import { runtimeLabels } from '@/lib/labels.ts';

export function ChatComposer(props: ChatComposerProps) {
  const {
    role,
    available,
    error,
    send,
    inputRef,
    busy,
    draft,
    setDrafts,
    thread,
    working,
    files,
    addFiles,
    removeFile,
  } = props;
  const disabled = busy || working || !role.enabled || !available;
  return (
    <div className="chat-compose">
      {!role.enabled || !available ? (
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
        onSubmit={({ text }) => send(text)}
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
        <ComposerAttachments
          files={files}
          addFiles={addFiles}
          removeFile={removeFile}
          disabled={disabled}
        />
        <PromptInputBody>
          <PromptInputTextarea
            ref={inputRef}
            aria-label={`Message ${role.name}`}
            placeholder={busy ? `${role.name} is working…` : `Message ${role.name}…`}
            value={draft}
            onChange={(e) => setDrafts((current) => ({ ...current, [thread]: e.target.value }))}
            disabled={disabled}
            onPaste={(event) => {
              const pasted = Array.from(event.clipboardData.files);
              if (pasted.length) {
                event.preventDefault();
                if (!disabled) addFiles(pasted);
              }
            }}
            maxLength={8000}
            className="chat-textarea"
          />
        </PromptInputBody>
        {props.reasoningOptions ? <ComposerReasoning {...props} /> : null}
        <ComposerFooter {...props} />
      </PromptInput>
      <ComposerHint role={role} />
    </div>
  );
}
