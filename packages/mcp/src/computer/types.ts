import { type BrowserAction, type BrowserSnapshot } from '@pitchcrew/core';

export interface BrowserDriver {
  validate?(action: BrowserAction): Promise<void>;
  snapshot(): Promise<BrowserSnapshot>;
  perform(
    action: BrowserAction,
    file?: { name: string; buffer: Buffer; mimeType?: string },
  ): Promise<void>;
  close(): Promise<void>;
}
