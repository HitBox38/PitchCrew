import { useMemo } from 'react';
import type { ChatComposerProps } from '../types.ts';
import { PromptInputBody } from '@/components/ai-elements/prompt-input/components/PromptInputBody.tsx';
import { ChatComposerEditor } from '@/ChatComposer/index.tsx';
import { composerSuggestions } from '@/ChatComposer/helpers.ts';
import type { ComposerSuggestion } from '@/ChatComposer/types.ts';

export const ComposerInput = (
  props: ChatComposerProps & {
    disabled: boolean;
    onAction: (action: NonNullable<ComposerSuggestion['action']>) => void;
  },
) => {
  const suggestions = useMemo(
    () =>
      composerSuggestions(
        props.data.roles,
        props.data.skills,
        props.participants,
        props.draft,
        props.busy || !!props.messages.length,
        (role) => {
          if (role.retiredAt) return 'Retired';
          if (!role.enabled) return 'Paused';
          const runtime = props.conversation?.configurations[role.id]?.runtime ?? role.runtime;
          return props.data.runtimes.some((entry) => entry.id === runtime && entry.available)
            ? undefined
            : 'Runtime unavailable';
        },
      ),
    [
      props.data.roles,
      props.data.skills,
      props.data.runtimes,
      props.participants,
      props.draft,
      props.busy,
      props.messages.length,
      props.conversation,
    ],
  );
  return (
    <PromptInputBody>
      <ChatComposerEditor
        thread={props.thread}
        inputRef={props.inputRef}
        value={props.draft}
        references={props.draftReferences}
        disabled={props.disabled}
        label={`Message ${props.participants.length > 1 ? 'the group' : props.role.name}`}
        placeholder={
          props.busy
            ? 'Send a follow-up while your agent works…'
            : `Message ${props.participants.length > 1 ? 'the group' : props.role.name}, or use @, $ or /…`
        }
        suggestions={suggestions}
        onAction={props.onAction}
        onFiles={props.addFiles}
        onChange={(text, references) => {
          props.setDrafts((current) => ({ ...current, [props.thread]: text }));
          props.setDraftReferences(references);
        }}
        onSend={(alternate) => {
          void props.send(
            props.draft,
            props.busy && alternate
              ? props.sendMode === 'queue'
                ? 'interrupt'
                : 'queue'
              : props.busy
                ? props.sendMode
                : 'queue',
          );
        }}
      />
    </PromptInputBody>
  );
};
