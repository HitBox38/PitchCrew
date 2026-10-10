import { useConversationEditor } from '../hooks/useConversationEditor.ts';
import type { ConversationEditorProps } from '../types.ts';
import { ChatSidePanel } from './ChatSidePanel.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ParticipantFields } from './editor/ParticipantFields.tsx';
import { ConversationSelect } from './ConversationSelect.tsx';
export function ConversationEditor({
  data,
  conversation,
  roleId,
  dialog,
  setDialog,
  action,
  onThread,
  working,
  jobItems,
}: ConversationEditorProps) {
  const {
    current,
    title,
    setTitle,
    participants,
    setParticipants,
    leadId,
    setLeadId,
    cardId,
    setCardId,
    error,
    save,
  } = useConversationEditor({ conversation, roleId, dialog, setDialog, action, onThread });
  return (
    <ChatSidePanel
      title={current ? 'Conversation settings' : 'New conversation'}
      onClose={() => {
        if (!working) setDialog(null);
      }}
      className="chat-editor"
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
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
        <ParticipantFields
          roles={data.roles}
          participants={participants}
          setParticipants={setParticipants}
          leadId={leadId}
          setLeadId={setLeadId}
        />
        <div className="field">
          <label htmlFor="conversation-job">Attached job</label>
          <ConversationSelect
            id="conversation-job"
            compact={false}
            label="Conversation job"
            value={cardId}
            items={jobItems}
            onChange={setCardId}
            disabled={!!current && data.messages.some((message) => message.threadId === current.id)}
          />
          <span className="optional">
            One job per conversation. Start another conversation for a different application.
          </span>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={working} onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button type="submit" disabled={working || !participants.length || !title.trim()}>
            {current ? 'Save conversation' : 'Create conversation'}
          </Button>
        </div>
      </form>
    </ChatSidePanel>
  );
}
