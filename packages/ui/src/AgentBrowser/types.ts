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
> & { onAttachBrowserFile?: (file: File) => void };
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
