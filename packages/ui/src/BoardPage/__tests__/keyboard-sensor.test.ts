import { describe, expect, it, vi } from 'vitest';
import { KeyboardSensor } from '@dnd-kit/dom';
import type { DragDropManager } from '@dnd-kit/dom';
import { PipelineKeyboardSensor, keyboardDestination } from '../keyboard-sensor.ts';

class TestSensor extends PipelineKeyboardSensor {
  finish(event: Event, canceled = false) {
    this.handleEnd(event, canceled);
  }
  moveGroup(direction: 'up' | 'down' | 'left' | 'right', event: KeyboardEvent) {
    this.handleMove(direction, event);
  }
}
function fixture() {
  const group = (id: string, left: number, width: number, disabled = false) => ({
    id,
    data: { state: id },
    disabled,
    element: {
      ownerDocument: { defaultView: { innerHeight: 844 } },
      getBoundingClientRect: () => ({ left, width, top: 80, height: 440 }),
      scrollIntoView: vi.fn(),
    },
  });
  const groups = [
    group('shortlisted', 0, 210),
    group('drafting', 222, 236),
    group('in_review', 470, 290, true),
    group('changes_requested', 772, 240),
  ];
  const manager = {
    dragOperation: { target: null, source: { data: { state: 'in_review' } } },
    registry: { droppables: groups },
    actions: { move: vi.fn(), setDropTarget: vi.fn() },
  };
  const sensor = Object.create(TestSensor.prototype) as TestSensor;
  sensor.manager = manager as unknown as DragDropManager;
  const event = { preventDefault: vi.fn() } as unknown as KeyboardEvent;
  return { sensor, manager, groups, event };
}

describe('keyboard status navigation', () => {
  it('preserves the chosen status when scrolling changes the collision target before dropping', () => {
    const { sensor, manager, event } = fixture();
    vi.spyOn(
      KeyboardSensor.prototype as unknown as { handleEnd(event: Event, canceled: boolean): void },
      'handleEnd',
    ).mockImplementation(() => {});
    sensor.moveGroup('left', event);
    (manager.dragOperation as { target: unknown }).target = {
      data: { state: 'changes_requested' },
    };
    const dropEvent = {} as Event;
    sensor.finish(dropEvent);
    expect(keyboardDestination(dropEvent)).toBe('drafting');
    const canceled = {} as Event;
    sensor.moveGroup('right', event);
    sensor.finish(canceled, true);
    expect(keyboardDestination(canceled)).toBeUndefined();
    expect(manager.actions.setDropTarget).toHaveBeenCalledWith('drafting');
    vi.restoreAllMocks();
  });
  it('keeps the preview in the visible part of a tall, scrolled column', () => {
    const { sensor, manager, groups, event } = fixture();
    groups[1].element.getBoundingClientRect = () => ({
      left: 222,
      width: 236,
      top: -1800,
      height: 3000,
    });
    sensor.moveGroup('left', event);
    expect(manager.actions.move).toHaveBeenCalledWith({ event, to: { x: 340, y: 422 } });
  });
  it('jumps left to the previous available status using its actual width', () => {
    const { sensor, manager, groups, event } = fixture();
    sensor.moveGroup('left', event);
    expect(manager.actions.move).toHaveBeenCalledWith({ event, to: { x: 340, y: 300 } });
    expect(groups[1].element.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'instant',
    });
  });
  it('visits statuses within one group vertically', () => {
    const { sensor, manager, event } = fixture();
    manager.dragOperation.source.data.state = 'drafting';
    sensor.moveGroup('down', event);
    expect(manager.actions.move).toHaveBeenCalledWith({ event, to: { x: 892, y: 300 } });
  });
  it('skips blocked statuses and leaves boundary moves alone', () => {
    const { sensor, manager, event } = fixture();
    manager.dragOperation.source.data.state = 'shortlisted';
    sensor.moveGroup('right', event);
    expect(manager.actions.move).toHaveBeenLastCalledWith({ event, to: { x: 340, y: 300 } });
    manager.dragOperation.source.data.state = 'drafting';
    sensor.moveGroup('right', event);
    expect(manager.actions.move).toHaveBeenLastCalledWith({ event, to: { x: 892, y: 300 } });
    manager.actions.move.mockClear();
    manager.dragOperation.source.data.state = 'changes_requested';
    sensor.moveGroup('right', event);
    expect(manager.actions.move).not.toHaveBeenCalled();
  });
});
