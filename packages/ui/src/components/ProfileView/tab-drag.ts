import { Accessibility, Feedback, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import {
  DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/react';
import { isSortableOperation } from '@dnd-kit/react/sortable';
import type { ComponentProps } from 'react';

export const profileTabSensors = [
  PointerSensor.configure({
    activatorElements: (source) => [source.element],
    preventActivation: (event) =>
      event.target instanceof Element && Boolean(event.target.closest('.profile-tab-close')),
    activationConstraints: (event) => [
      event.pointerType === 'touch'
        ? new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })
        : new PointerActivationConstraints.Distance({ value: 6 }),
    ],
  }),
];

const position = ({ operation }: DragOverEvent | DragEndEvent) =>
  isSortableOperation(operation) && operation.source
    ? `Position ${operation.source.index + 1} of ${operation.source.data.count}.`
    : '';

export const profileTabPlugins: ComponentProps<typeof DragDropProvider>['plugins'] = (defaults) => [
  ...defaults,
  Feedback.configure({ dropAnimation: null, keyboardTransition: null }),
  Accessibility.configure({
    screenReaderInstructions: {
      draggable: 'To reorder a tab, press Alt and the left or right arrow key.',
    },
    announcements: {
      dragstart: ({ operation }: DragStartEvent) =>
        `Picked up ${operation.source?.data.label}. Drag to reorder or Escape to cancel.`,
      dragover: (event: DragOverEvent) => position(event),
      dragend: (event: DragEndEvent) =>
        event.canceled || !event.operation.target
          ? 'Tab reorder canceled.'
          : `Moved ${event.operation.source?.data.label}. ${position(event)}`,
    },
  }),
];
