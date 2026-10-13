import { RestrictToElement } from '@dnd-kit/dom/modifiers';

// Keep the preview level with the tabs and inside the visible, scrollable strip.
export class ProfileTabRow extends RestrictToElement {
  constructor(manager: ConstructorParameters<typeof RestrictToElement>[0]) {
    super(manager, {
      element: ({ source }) => source?.element?.closest('.profile-document-tabs') ?? null,
    });
  }

  override apply(operation: Parameters<RestrictToElement['apply']>[0]) {
    return { ...super.apply(operation), y: 0 };
  }
}

export const profileTabModifiers = [ProfileTabRow];
