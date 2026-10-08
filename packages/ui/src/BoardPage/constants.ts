import { Accessibility, Feedback, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import type { ComponentProps } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/react';
import { PipelineKeyboardSensor } from './keyboard-sensor.ts';

export const pipelineSensors = [
  PointerSensor.configure({
    activatorElements: (source) => [source.element],
    preventActivation: () => false,
    activationConstraints: (event) => [
      event.pointerType === 'touch'
        ? new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })
        : new PointerActivationConstraints.Distance({ value: 6 }),
    ],
  }),
  PipelineKeyboardSensor,
];

export const pipelinePlugins: ComponentProps<typeof DragDropProvider>['plugins'] = (defaults) => [
  ...defaults,
  Feedback.configure({ dropAnimation: null, keyboardTransition: null }),
  Accessibility.configure({
    announcements: {
      dragstart: ({ operation: { source } }: DragStartEvent) =>
        `Picked up ${source?.data.label ?? 'job'}. Use arrow keys to choose a group, Space to drop, or Escape to cancel.`,
      dragover: ({ operation: { target } }: DragOverEvent) =>
        target ? `${target.data.label}. ${target.data.action}.` : 'Outside an available group.',
      dragend: ({ operation: { target }, canceled }: DragEndEvent) =>
        canceled
          ? 'Move canceled.'
          : target
            ? `Dropped in ${target.data.label}. Saving the change.`
            : 'No move made.',
    },
  }),
];
