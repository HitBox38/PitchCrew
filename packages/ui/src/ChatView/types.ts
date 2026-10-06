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
  | 'role'
  | 'available'
  | 'error'
  | 'send'
  | 'reasoningOptions'
  | 'reasoningChoice'
  | 'setReasoningChoice'
  | 'inputRef'
  | 'busy'
  | 'draft'
  | 'setDrafts'
  | 'thread'
  | 'working'
  | 'recipient'
  | 'recipientItems'
  | 'setRecipient'
  | 'cardId'
  | 'jobItems'
  | 'setJobs'
  | 'attached'
  | 'onOpenCard'
>;

export type ChatProgressProps = Pick<ChatViewModel, 'running' | 'name' | 'working' | 'action'>;

export type ComposerContextProps = Pick<
  ChatViewModel,
  | 'thread'
  | 'recipient'
  | 'recipientItems'
  | 'working'
  | 'setRecipient'
  | 'cardId'
  | 'jobItems'
  | 'busy'
  | 'setJobs'
  | 'attached'
  | 'onOpenCard'
>;

export type ComposerHintProps = Pick<ChatViewModel, 'role'>;

export type ConversationHeadingProps = Pick<
  ChatViewModel,
  'thread' | 'roleId' | 'role' | 'roleState' | 'running' | 'data' | 'onConfigure'
>;

export type ConversationPanelProps = Pick<
  ChatViewModel,
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
>;

export type ConversationRailProps = Pick<
  ChatViewModel,
  'data' | 'thread' | 'onThread' | 'setError'
>;

export type ConversationWelcomeProps = Pick<
  ChatViewModel,
  'thread' | 'roleId' | 'role' | 'applyStarter' | 'attached'
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
>;

export type MessageTranscriptProps = Pick<
  ChatViewModel,
  'messages' | 'data' | 'streamingIds' | 'reduced' | 'name' | 'thread' | 'onOpenCard'
>;
