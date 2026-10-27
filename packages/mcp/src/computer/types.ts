import type { Page } from 'playwright';
import type {
  NativeBrowserIdentity,
  NativeBrowserState,
  NativeBrowserCommand,
} from '../../../core/src/native-browser.ts';
import {
  type BrowserAction,
  type BrowserTab,
  type BrowserTabsCommand,
  type BrowserWait,
  type BrowserSnapshot,
  type BrowserFrame,
  type BrowserInput,
  type BrowserViewport,
} from '@pitchcrew/core';

export type BrowserFrameEvent = BrowserFrame | { error: string };
export type BrowserFrameListener = (event: BrowserFrameEvent) => void;

export interface BrowserDriver {
  native?: NativeBrowserIdentity;
  onClosed?(receive: () => void): () => void;
  nativeState?(): Promise<NativeBrowserState>;
  nativeCommand?(command: NativeBrowserCommand): Promise<NativeBrowserState>;
  rememberManualFields?(fingerprints: readonly string[]): void;
  setManual?(allowed: boolean): Promise<void>;
  resetSignIns?(): Promise<void>;
  selectPage?(page: Page): void;
  newTab?(): Promise<BrowserDriver>;
  validateApplicationValues?(values: readonly string[], action: BrowserAction): Promise<void>;
  validate?(action: BrowserAction): Promise<void>;
  tabs?(command: BrowserTabsCommand): Promise<BrowserTab[]>;
  targetTab?(id: string): Promise<void>;
  resolveAction?(action: BrowserAction): Promise<BrowserAction>;
  matches?(condition: BrowserWait): Promise<boolean>;
  snapshot(options?: { includeImage?: boolean; references?: boolean }): Promise<BrowserSnapshot>;
  getViewport?(): BrowserViewport;
  viewMetadata?(): Pick<BrowserFrame, 'dialog' | 'warning'>;
  resize?(viewport: BrowserViewport): Promise<boolean>;
  frame?(): Promise<BrowserFrame>;
  subscribeFrames?(receive: BrowserFrameListener): () => void;
  input?(input: BrowserInput): Promise<void>;
  freshPage?(): Promise<void>;
  exploration?(action: BrowserAction): Promise<boolean>;
  automatic?(action: BrowserAction): Promise<boolean>;
  prepare?(enabled: boolean, sites?: readonly string[]): void;
  invalidate?(): void;
  perform(
    action: BrowserAction,
    file?: { name: string; buffer: Buffer; mimeType?: string },
    automatic?: boolean,
  ): Promise<void>;
  close(): Promise<void>;
}
