import { describe, expect, it } from 'vitest';
import type { Conversation, Role } from '@pitchcrew/core';
import { browserModeOptions, conversationBrowserMode, savedBrowserMode } from '../browser-modes.ts';

const role = (browserMode?: Role['browserMode']) => ({ id: 'submitter', browserMode });
const conversation = (configurations: Conversation['configurations']) => ({ configurations });

describe('browser mode choices', () => {
  it('offers every mode, most supervised first, in the shared words', () => {
    expect(browserModeOptions).toEqual([
      { value: 'supervised', label: 'Supervised' },
      { value: 'autonomous', label: 'Autonomous preparation' },
      { value: 'edits', label: 'Accept edits' },
      { value: 'auto', label: 'Auto' },
      { value: 'full', label: 'Full access' },
    ]);
  });
  it('treats an agent saved before modes existed as supervised', () => {
    expect(savedBrowserMode(undefined)).toBe('supervised');
    expect(savedBrowserMode(role())).toBe('supervised');
    expect(savedBrowserMode(role('auto'))).toBe('auto');
  });
  it('uses the conversation override for the next turn, else the saved default', () => {
    expect(conversationBrowserMode(role('edits'))).toBe('edits');
    expect(conversationBrowserMode(role('edits'), conversation({}))).toBe('edits');
    expect(
      conversationBrowserMode(role('edits'), conversation({ submitter: { model: 'fictional' } })),
    ).toBe('edits');
    expect(
      conversationBrowserMode(role(), conversation({ submitter: { browserMode: 'full' } })),
    ).toBe('full');
    // Another participant's override never applies.
    expect(conversationBrowserMode(role(), conversation({ scout: { browserMode: 'full' } }))).toBe(
      'supervised',
    );
  });
});
