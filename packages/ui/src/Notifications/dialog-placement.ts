/** Where the toast stack sits while a modal dialog is open, so it never covers the dialog's footer. */
export type ToastPlacement =
  | { side: 'right' | 'left'; bottom: number }
  | { side: 'above-footer'; bottom: number };

type Box = { left: number; right: number; bottom: number };

const margin = 16;

/**
 * Bottom-right while that corner is outside the dialog, else bottom-left when that side is clear,
 * else just above the dialog's footer (16px clear of its top edge).
 */
export const toastPlacement = (
  dialog: Box,
  footerTop: number | null,
  viewport: { width: number; height: number },
  toastWidth: number,
): ToastPlacement => {
  const room = toastWidth + margin * 2;
  if (viewport.width - dialog.right >= room) return { side: 'right', bottom: margin };
  if (dialog.left >= room) return { side: 'left', bottom: margin };
  const footer = footerTop ?? dialog.bottom - 64;
  return { side: 'above-footer', bottom: Math.max(margin, viewport.height - footer + margin) };
};
