import type { ChatViewModel } from '@/ChatView/types.ts';
import type { useBrowserControl } from './hooks/useBrowserControl.ts';
import type { BrowserFrame } from '@pitchcrew/core';
export type AgentBrowserProps = Pick<
  ChatViewModel,
  | 'browserPanel'
  | 'data'
  | 'thread'
  | 'conversation'
  | 'action'
  | 'working'
  | 'onOpenCard'
  | 'onThread'
> &
  BrowserReplyProps & { onAttachBrowserFile?: (file: File) => void };
/** The conversation's shared draft and send path, for the clay expanded view's message box. */
export type BrowserReplyProps = Pick<
  ChatViewModel,
  | 'thread'
  | 'data'
  | 'working'
  | 'draft'
  | 'setDrafts'
  | 'draftReferences'
  | 'setDraftReferences'
  | 'send'
  | 'busy'
  | 'busyElsewhere'
  | 'running'
  | 'sendMode'
  | 'available'
  | 'readOnly'
  | 'files'
  | 'participants'
  | 'questions'
  | 'error'
>;
export type BrowserControl = ReturnType<typeof useBrowserControl>;
export type BrowserViewProps = {
  size: { width: number; height: number };
  frame: BrowserFrame;
  manual: boolean;
  control: BrowserControl;
  name: string;
  zoom: number;
  panView: boolean;
};
