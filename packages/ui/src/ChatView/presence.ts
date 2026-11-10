import { createPresence } from '@pitchcrew/design-system/presence';

/**
 * What the chat workspace and its panel hold, as `data-has-` attributes (a side panel, the docked
 * browser; the question dock, a hidden composer, the empty welcome). Their styles used to ask
 * with `:has()` over the whole transcript, which Chrome rechecked after every change.
 */
export const chatWorkspacePresence = createPresence();
export const chatPanelPresence = createPresence();
