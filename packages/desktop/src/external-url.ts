import { externalUrlBlockReason } from '../../core/src/desktop-links.ts';
export { externalUrlBlockReason } from '../../core/src/desktop-links.ts';

/** Only web URLs may be handed to the system browser, never files or native protocols. */
export const isAllowedExternalUrl = (value: string) => externalUrlBlockReason(value) === null;
