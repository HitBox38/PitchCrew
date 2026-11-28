import { externalUrlBlockReason } from '@pitchcrew/core/desktop-links';
export { externalUrlBlockReason } from '@pitchcrew/core/desktop-links';

/** Only web URLs may be handed to the system browser, never files or native protocols. */
export const isAllowedExternalUrl = (value: string) => externalUrlBlockReason(value) === null;
