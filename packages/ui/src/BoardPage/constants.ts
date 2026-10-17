import { Accessibility, Feedback, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import type { ComponentProps } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/react';

export const pipelineSensors = [
  PointerSensor.configure({
    activatorElements: (source) => [source.element],
    preventActivation: (event, source) =>
      !source.data.movable ||
      event.pointerType !== 'mouse' ||
      (event.target instanceof Element && !!event.target.closest('.job-actions-trigger')),
    activationConstraints: [new PointerActivationConstraints.Distance({ value: 6 })],
  }),
];

export const pipelinePlugins: ComponentProps<typeof DragDropProvider>['plugins'] = (defaults) => [
  ...defaults,
  Feedback.configure({ dropAnimation: null, keyboardTransition: null }),
  Accessibility.configure({
    screenReaderInstructions: {
      draggable:
        'Open the job with Enter. Use the adjacent job actions menu to change its status with the keyboard.',
    },
    announcements: {
      dragstart: ({ operation: { source } }: DragStartEvent) =>
        `Picked up ${source?.data.label ?? 'job'}. Drag to a status and release to move. Escape cancels. Use the job actions menu for keyboard moves.`,
      dragover: ({ operation: { target } }: DragOverEvent) =>
        target ? `${target.data.label}. ${target.data.action}.` : 'Outside an available status.',
      dragend: ({ operation: { target }, canceled }: DragEndEvent) =>
        canceled
          ? 'Move canceled.'
          : target
            ? `Dropped in ${target.data.label}. Saving the change.`
            : 'No move made.',
    },
  }),
];
