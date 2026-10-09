import type { ChatComposerProps } from '../types.ts';
import { PromptInputBody } from '@/components/ai-elements/prompt-input/components/PromptInputBody.tsx';
import { PromptInputTextarea } from '@/components/ai-elements/prompt-input/components/PromptInputTextarea.tsx';
export function ComposerInput(props: ChatComposerProps & { disabled: boolean }) {
  const { role, inputRef, busy, draft, setDrafts, thread, addFiles, send, disabled } = props;
  return (
    <PromptInputBody>
      <PromptInputTextarea
        ref={inputRef}
        aria-label={`Message ${props.participants.length > 1 ? 'the group' : role.name}`}
        placeholder={
          props.participants.length > 1
            ? 'Message the group, or @mention an agent…'
            : busy
              ? 'Send a follow-up while your agent works…'
              : `Message ${role.name}…`
        }
        value={draft}
        onChange={(e) => setDrafts((current) => ({ ...current, [thread]: e.target.value }))}
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void send(
              draft,
              event.shiftKey
                ? props.sendMode === 'queue'
                  ? 'interrupt'
                  : 'queue'
                : props.sendMode,
            );
          }
        }}
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
  );
}
