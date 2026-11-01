import type { ChatViewModel } from '../types.ts';
import { ChatSidePanel } from './ChatSidePanel.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { ModelField } from '@/ModelField/index.tsx';
import { useConversationRuntime } from '../hooks/useConversationRuntime.ts';
import { RuntimeFields } from './editor/RuntimeFields.tsx';
import { PanelActions } from './editor/PanelActions.tsx';
import { PanelSection } from './PanelSection.tsx';
const intro =
  'Defaults follow each agent’s Crew settings. Overrides apply only to this conversation.';
export const ConversationRuntime = (props: ChatViewModel) => {
  const { role, setDialog, working, error } = props;
  const state = useConversationRuntime(props);
  const { runtime, model, reasoning, defaults, effectiveRuntime, selected } = state;
  return (
    <ChatSidePanel
      returnFocus=".chat-composer-runtime"
      title="Conversation runtime"
      onClose={() => setDialog(null)}
      className="chat-editor"
      icon={<RoleAvatar agentRole={role.id} />}
      description={intro}
    >
      <form
        className="form chat-runtime-form chat-panel-form"
        onSubmit={(event) => {
          event.preventDefault();
          void state.save();
        }}
      >
        <PanelSection>
          <RuntimeFields
            {...props}
            runtime={runtime}
            defaultRuntime={defaults.runtime}
            changeRuntime={state.changeRuntime}
          />
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
        </PanelSection>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <PanelActions>
          <Button className="button" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button className="button primary" type="submit" disabled={working || !state.canSave}>
            Save runtime
          </Button>
        </PanelActions>
      </form>
    </ChatSidePanel>
  );
};
