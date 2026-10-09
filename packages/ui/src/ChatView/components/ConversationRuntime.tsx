import type { ChatViewModel } from '../types.ts';
import { ChatSidePanel } from './ChatSidePanel.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ModelField } from '@/ModelField/index.tsx';
import { runtimeLabels } from '@/lib/labels.ts';
import { ConversationSelect } from './ConversationSelect.tsx';
import { useConversationRuntime } from '../hooks/useConversationRuntime.ts';
export function ConversationRuntime(props: ChatViewModel) {
  const { data, role, recipientItems, setRecipient, setDialog, working, error } = props;
  const state = useConversationRuntime(props);
  const { runtime, model, reasoning, defaults, effectiveRuntime, selected } = state;
  return (
    <ChatSidePanel
      returnFocus=".chat-runtime"
      title="Conversation runtime"
      onClose={() => setDialog(null)}
      className="chat-editor"
    >
      <p className="modal-intro">
        Defaults follow each agent’s Crew settings. Overrides apply only to this conversation.
      </p>
      <form
        className="form chat-runtime-form grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void state.save();
        }}
      >
        {recipientItems.length > 1 ? (
          <div className="field">
            <label htmlFor="conversation-participant">Agent</label>
            <ConversationSelect
              id="conversation-participant"
              compact={false}
              label="Configure participant"
              value={role.id}
              items={recipientItems}
              onChange={setRecipient}
            />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="conversation-runtime">Runtime</label>
          <ConversationSelect
            id="conversation-runtime"
            compact={false}
            label="Conversation runtime"
            value={runtime ?? 'agent'}
            items={[
              { value: 'agent', label: `Use agent default (${runtimeLabels[defaults.runtime]})` },
              ...data.runtimes
                .filter((entry) => entry.available)
                .map((entry) => ({ value: entry.id, label: runtimeLabels[entry.id] })),
            ]}
            onChange={state.changeRuntime}
          />
        </div>
        <ModelField
          conversation
          key={effectiveRuntime}
          id="conversation-model"
          runtime={effectiveRuntime}
          available={selected.available}
          initialCatalog={selected}
          value={model ?? defaults.model}
          onValueChange={state.setModel}
          reasoning={reasoning === undefined ? (defaults.reasoning ?? null) : reasoning}
          onReasoningChange={state.setReasoning}
          agentDefaults={defaults}
          inheritModel={model === undefined}
          inheritReasoning={reasoning === undefined}
          onInheritModel={() => state.setModel(undefined)}
          onInheritReasoning={() => state.setReasoning(undefined)}
        />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="ghost" onClick={() => setDialog(null)}>
            Close
          </Button>
          <Button type="submit" disabled={working || !state.canSave}>
            Save runtime
          </Button>
        </div>
      </form>
    </ChatSidePanel>
  );
}
