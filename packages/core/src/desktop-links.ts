export type DesktopLinkBlockedReason =
  | 'invalid-url'
  | 'embedded-credentials'
  | 'unsupported-protocol';

/** Read-only feedback: no URLs, native events or link-opening commands reach the renderer. */
export interface DesktopLinkBridge {
  subscribe(listener: (reason: DesktopLinkBlockedReason) => void): () => void;
}

/** Shared by the click guard and the native boundary; never include URL content in feedback. */
export const externalUrlBlockReason = (
  value: string,
  base?: string,
): DesktopLinkBlockedReason | null => {
  try {
    const url = new URL(value, base);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'unsupported-protocol';
    if (url.username || url.password) return 'embedded-credentials';
    return null;
  } catch {
    return 'invalid-url';
  }
};
