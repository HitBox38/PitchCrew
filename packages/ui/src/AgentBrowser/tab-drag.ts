import { Accessibility, Feedback, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import { RestrictToElement } from '@dnd-kit/dom/modifiers';
import type { DragDropProvider, DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/react';
import { isSortableOperation } from '@dnd-kit/react/sortable';
import type { ComponentProps } from 'react';

/** Whole-tab dragging, except from its close and audio buttons. */
export const browserTabSensors = [
  PointerSensor.configure({
    activatorElements: (source) => [source.element],
    preventActivation: (event) =>
      event.target instanceof Element &&
      Boolean(event.target.closest('.browser-tab-close, .browser-tab-audio')),
    activationConstraints: (event) => [
      event.pointerType === 'touch'
        ? new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })
        : new PointerActivationConstraints.Distance({ value: 6 }),
    ],
  }),
];

// Keep the preview level with the tabs and inside the visible, scrollable strip.
class BrowserTabRow extends RestrictToElement {
  constructor(manager: ConstructorParameters<typeof RestrictToElement>[0]) {
    super(manager, {
      element: ({ source }) => source?.element?.closest('.browser-tabs') ?? null,
    });
  }

  override apply(operation: Parameters<RestrictToElement['apply']>[0]) {
    return { ...super.apply(operation), y: 0 };
  }
}

export const browserTabModifiers = [BrowserTabRow];

const position = ({ operation }: DragOverEvent | DragEndEvent) =>
  isSortableOperation(operation) && operation.source
    ? `Position ${operation.source.index + 1} of ${operation.source.data.count}.`
    : '';

export const browserTabPlugins: ComponentProps<typeof DragDropProvider>['plugins'] = (defaults) => [
  ...defaults,
  Feedback.configure({ dropAnimation: null, keyboardTransition: null }),
  Accessibility.configure({
    screenReaderInstructions: {
      draggable: 'To move a tab, press Control, Shift and Page Up or Page Down.',
    },
    announcements: {
      dragstart: ({ operation }: DragStartEvent) =>
        `Picked up ${operation.source?.data.label}. Drag to move it or Escape to cancel.`,
      dragover: (event: DragOverEvent) => position(event),
      dragend: (event: DragEndEvent) =>
        event.canceled || !event.operation.target
          ? 'Tab move canceled.'
          : `Moved ${event.operation.source?.data.label}. ${position(event)}`,
    },
  }),
];

/** The tab order with one tab moved, for an optimistic strip while the native state catches up. */
export const movedTabOrder = (ids: string[], id: string, index: number) => {
  const rest = ids.filter((item) => item !== id);
  if (rest.length === ids.length) return ids;
  rest.splice(Math.max(0, Math.min(index, rest.length)), 0, id);
  return rest;
};
