import { KeyboardSensor } from '@dnd-kit/dom';
import type { Draggable, KeyboardSensorOptions } from '@dnd-kit/dom';
import { states } from '@pitchcrew/core/states';
import type { CardState } from '@pitchcrew/core';

const keyboardDestinations = new WeakMap<Event, CardState>();
export function keyboardDestination(event?: Event | null) {
  return event ? keyboardDestinations.get(event) : undefined;
}

/** Arrow keys visit each exact status, including statuses in the same board group. */
export class PipelineKeyboardSensor extends KeyboardSensor {
  private destination?: CardState;
  protected override handleStart(
    event: KeyboardEvent,
    source: Draggable,
    options: KeyboardSensorOptions | undefined,
  ) {
    this.destination = undefined;
    super.handleStart(event, source, options);
  }
  protected override handleEnd(event: Event, canceled: boolean) {
    if (!canceled && this.destination) keyboardDestinations.set(event, this.destination);
    super.handleEnd(event, canceled);
    this.destination = undefined;
  }
  protected override handleMove(direction: 'up' | 'down' | 'left' | 'right', event: KeyboardEvent) {
    event.preventDefault();
    const operation = this.manager.dragOperation;
    const currentState = this.destination ?? operation.source?.data.state;
    const currentIndex = states.findIndex((state) => state === currentState);
    const sign = direction === 'left' || direction === 'up' ? -1 : 1;
    const target = [...this.manager.registry.droppables]
      .filter((item) => !item.disabled && item.element)
      .map((item) => ({ item, index: states.findIndex((state) => state === item.data.state) }))
      .filter(({ index }) => index >= 0 && (index - currentIndex) * sign > 0)
      .sort((a, b) => Math.abs(a.index - currentIndex) - Math.abs(b.index - currentIndex))[0]?.item;
    if (!target?.element) return;
    this.destination = states.find((state) => state === target.data.state);
    const destination = this.destination;
    if (destination) {
      keyboardDestinations.set(event, destination);
      if (operation.activatorEvent) keyboardDestinations.set(operation.activatorEvent, destination);
    }
    target.element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    const frame = target.element.ownerDocument?.defaultView?.requestAnimationFrame?.bind(
      target.element.ownerDocument.defaultView,
    );
    const schedule = (action: () => void) => (frame ? frame(action) : action());
    // Let scroll compensation settle before positioning the preview and selecting the target.
    schedule(() =>
      schedule(() => {
        if (this.destination !== destination || !target.element) return;
        const rect = target.element.getBoundingClientRect();
        const viewportHeight =
          target.element.ownerDocument?.defaultView?.innerHeight ?? rect.top + rect.height;
        const top = Math.max(0, rect.top);
        const bottom = Math.min(viewportHeight, rect.top + rect.height);
        this.manager.actions.move({
          event,
          to: { x: rect.left + rect.width / 2, y: top + (bottom - top) / 2 },
        });
        schedule(() => {
          if (this.destination === destination) void this.manager.actions.setDropTarget(target.id);
        });
      }),
    );
  }
}
