import { useConversationEditor } from '../hooks/useConversationEditor.ts';
import type { ConversationEditorProps } from '../types.ts';
import { ChatSidePanel } from './ChatSidePanel.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import { MessageSquarePlus, Users } from 'lucide-react';
import { ParticipantFields } from './editor/ParticipantFields.tsx';
import { ConversationEditorActions } from './editor/ConversationEditorActions.tsx';
import { JobField } from './editor/JobField.tsx';
import { PanelSection } from './PanelSection.tsx';
export const ConversationEditor = ({
  data,
  conversation,
  roleId,
  dialog,
  setDialog,
  action,
  onThread,
  working,
  jobItems,
}: ConversationEditorProps) => {
  const editor = useConversationEditor({
    conversation,
    roleId,
    dialog,
    setDialog,
    action,
    onThread,
  });
  const { current, title, setTitle, participants, setParticipants, leadId, setLeadId } = editor;
  return (
    <ChatSidePanel
      title={current ? 'Conversation settings' : 'New conversation'}
      onClose={() => {
        if (!working) setDialog(null);
      }}
      className="chat-editor"
      icon={current ? <Users size={15} /> : <MessageSquarePlus size={15} />}
    >
      <form
        className="form chat-panel-form"
        onSubmit={(event) => {
          event.preventDefault();
          void editor.save();
        }}
      >
        <PanelSection>
          <div className="field">
            <label htmlFor="conversation-title">Name</label>
            <Input
              id="conversation-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="What are you working on?"
              required
            />
          </div>
        </PanelSection>
        <ParticipantFields
          roles={data.roles}
          participants={participants}
          setParticipants={setParticipants}
          leadId={leadId}
          setLeadId={setLeadId}
        />
        <PanelSection>
          <JobField
            value={editor.cardId}
            onChange={editor.setCardId}
            items={jobItems}
            locked={!!current && data.messages.some((message) => message.threadId === current.id)}
          />
        </PanelSection>
        {editor.error ? (
          <p className="form-error" role="alert">
            {editor.error}
          </p>
        ) : null}
        <ConversationEditorActions
          editing={!!current}
          working={working}
          disabled={working || !participants.length || !title.trim()}
          close={() => setDialog(null)}
        />
      </form>
    </ChatSidePanel>
  );
};
