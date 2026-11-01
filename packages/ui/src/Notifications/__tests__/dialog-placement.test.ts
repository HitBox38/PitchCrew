import { describe, expect, it } from 'vitest';
import { toastPlacement } from '../dialog-placement.ts';

const viewport = { width: 1440, height: 900 };

describe('toast placement beside dialogs', () => {
  it('stays bottom-right when the dialog leaves that corner free', () => {
    expect(toastPlacement({ left: 400, right: 1040, bottom: 845 }, 780, viewport, 360)).toEqual({
      side: 'right',
      bottom: 16,
    });
  });
  it('moves left when the dialog covers the right edge but not the left', () => {
    const sheet = { left: 760, right: 1440, bottom: 900 };
    expect(toastPlacement(sheet, 836, viewport, 360)).toEqual({ side: 'left', bottom: 16 });
  });
  it('sits 16px above the footer when neither side has room', () => {
    const wide = { left: 200, right: 1240, bottom: 880 };
    expect(toastPlacement(wide, 816, viewport, 360)).toEqual({ side: 'above-footer', bottom: 100 });
    const phone = { left: 0, right: 390, bottom: 844 };
    expect(toastPlacement(phone, null, { width: 390, height: 844 }, 358)).toEqual({
      side: 'above-footer',
      bottom: 80,
    });
  });
});
