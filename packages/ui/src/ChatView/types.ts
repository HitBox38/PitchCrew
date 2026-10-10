import type { useChatView } from '@/ChatView/hooks/useChatView.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { RoleId, Snapshot } from '@pitchcrew/core';

export type ChatThread = RoleId | 'crew';

export interface ChatViewProps {
  data: Snapshot;
  thread: ChatThread;
  onThread: (thread: ChatThread) => void;
  onConfigure: (id: RoleId) => void;
  onOpenCard: (id: string) => void;
  action: Action;
  working: boolean;
}
export type ChatViewModel = NonNullable<ReturnType<typeof useChatView>>;

export type ChatComposerProps = Pick<
  ChatViewModel,
  | 'messages'
  | 'role'
  | 'available'
  | 'error'
  | 'send'
  | 'files'
  | 'addFiles'
  | 'removeFile'
  | 'inputRef'
  | 'busy'
  | 'busyElsewhere'
  | 'draft'
  | 'setDrafts'
  | 'thread'
  | 'working'
  | 'recipient'
  | 'recipientItems'
  | 'setRecipient'
  | 'cardId'
  | 'jobItems'
  | 'patchConversation'
  | 'attached'
  | 'onOpenCard'
  | 'readOnly'
  | 'conversation'
  | 'participants'
  | 'sendMode'
  | 'setSendMode'
>;

export type ChatProgressProps = Pick<
  ChatViewModel,
  'running' | 'name' | 'working' | 'action' | 'thread'
>;

export type ComposerHintProps = Pick<ChatViewModel, 'role'>;

export type ConversationHeadingProps = Pick<
  ChatViewModel,
  | 'questions'
  | 'attention'
  | 'thread'
  | 'roleId'
  | 'role'
  | 'roleState'
  | 'running'
  | 'data'
  | 'onConfigure'
  | 'conversation'
  | 'participants'
  | 'setDialog'
  | 'patchConversation'
  | 'action'
  | 'working'
  | 'messages'
  | 'readOnly'
  | 'recipient'
  | 'recipientItems'
  | 'setRecipient'
>;

export type ConversationPanelProps = Pick<
  ChatViewModel,
  | 'answerQuestion'
  | 'thread'
  | 'role'
  | 'name'
  | 'messages'
  | 'roleId'
  | 'applyStarter'
  | 'attached'
  | 'data'
  | 'streamingIds'
  | 'reduced'
  | 'onOpenCard'
  | 'readOnly'
  | 'conversation'
  | 'participants'
  | 'sendMode'
  | 'setSendMode'
>;

export type ConversationWelcomeProps = Pick<
  ChatViewModel,
  'thread' | 'roleId' | 'role' | 'applyStarter' | 'attached' | 'conversation' | 'readOnly'
>;

export type CrewWorkPanelProps = Pick<
  ChatViewModel,
  | 'data'
  | 'thread'
  | 'role'
  | 'proposals'
  | 'skillProposals'
  | 'tasks'
  | 'action'
  | 'working'
  | 'onConfigure'
  | 'roleId'
  | 'onOpenCard'
  | 'readOnly'
  | 'conversation'
  | 'participants'
  | 'sendMode'
  | 'setSendMode'
>;

export type MessageTranscriptProps = Pick<
  ChatViewModel,
  | 'messages'
  | 'data'
  | 'streamingIds'
  | 'reduced'
  | 'name'
  | 'thread'
  | 'onOpenCard'
  | 'answerQuestion'
>;

export type ConversationEditorProps = Pick<
  ChatViewModel,
  | 'data'
  | 'conversation'
  | 'roleId'
  | 'dialog'
  | 'setDialog'
  | 'action'
  | 'onThread'
  | 'working'
  | 'jobItems'
>;
