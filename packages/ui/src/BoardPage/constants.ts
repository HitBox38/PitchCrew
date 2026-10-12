import { Accessibility, Feedback, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import type { ComponentProps } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/react';
import { PipelineKeyboardSensor } from './keyboard-sensor.ts';
import { keyboardDestination } from './keyboard-sensor.ts';
import { stateLabels } from '@/lib/labels.ts';

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
        `Picked up ${source?.data.label ?? 'job'}. Use arrow keys to choose a status, Space to drop, or Escape to cancel.`,
      dragover: ({ operation: { target, activatorEvent } }: DragOverEvent) => {
        const state = keyboardDestination(activatorEvent);
        return state
          ? `${stateLabels[state]}. Drop to move to ${stateLabels[state]}.`
          : target
            ? `${target.data.label}. ${target.data.action}.`
            : 'Outside an available status.';
      },
      dragend: ({ operation: { target }, canceled, nativeEvent }: DragEndEvent) =>
        canceled
          ? 'Move canceled.'
          : keyboardDestination(nativeEvent)
            ? `Dropped in ${stateLabels[keyboardDestination(nativeEvent)!]}. Saving the change.`
            : target
              ? `Dropped in ${target.data.label}. Saving the change.`
              : 'No move made.',
    },
  }),
];
