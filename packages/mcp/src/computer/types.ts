import {
  type BrowserAction,
  type BrowserSnapshot,
  type BrowserFrame,
  type BrowserInput,
  type BrowserViewport,
} from '@pitchcrew/core';

export interface BrowserDriver {
  validate?(action: BrowserAction): Promise<void>;
  snapshot(): Promise<BrowserSnapshot>;
  resize?(viewport: BrowserViewport): Promise<boolean>;
  frame?(): Promise<BrowserFrame>;
  input?(input: BrowserInput): Promise<void>;
  freshPage?(): Promise<void>;
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
