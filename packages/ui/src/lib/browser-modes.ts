import type { BrowserMode, Conversation, Role } from '@pitchcrew/core';
import { browserModeLabels, browserModeOrder } from '@pitchcrew/core/browser-modes';

/** Every browser mode as a select option, most supervised first, in the shared words. */
export const browserModeOptions = browserModeOrder.map((value) => ({
  value,
  label: browserModeLabels[value],
}));

/** An agent's saved default; agents saved before browser modes existed browse supervised. */
export const savedBrowserMode = (role: Pick<Role, 'browserMode'> | undefined): BrowserMode =>
  role?.browserMode ?? 'supervised';

/**
 * The mode the agent's next turn in this conversation uses: the conversation's override, else the
 * agent's saved default. Pass the saved role, not one already merged with the override.
 */
export const conversationBrowserMode = (
  role: Pick<Role, 'id' | 'browserMode'>,
  conversation?: Pick<Conversation, 'configurations'>,
): BrowserMode => conversation?.configurations[role.id]?.browserMode ?? savedBrowserMode(role);
