import { type BrowserAction, type BrowserSnapshot } from '@pitchcrew/core';

export interface BrowserDriver {
  snapshot(): Promise<BrowserSnapshot>;
  perform(action: BrowserAction, file?: { name: string; buffer: Buffer }): Promise<void>;
  close(): Promise<void>;
}
