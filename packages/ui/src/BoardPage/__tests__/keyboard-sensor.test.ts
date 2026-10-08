import { describe, expect, it, vi } from 'vitest';
import type { DragDropManager } from '@dnd-kit/dom';
import { PipelineKeyboardSensor } from '../keyboard-sensor.ts';

class TestSensor extends PipelineKeyboardSensor {
  moveGroup(direction: 'left' | 'right', event: KeyboardEvent) {
    this.handleMove(direction, event);
  }
}
function fixture() {
  const group = (id: string, left: number, width: number, disabled = false) => ({
    id,
    disabled,
    element: {
      ownerDocument: { defaultView: { innerHeight: 844 } },
      getBoundingClientRect: () => ({ left, width, top: 80, height: 440 }),
      scrollIntoView: vi.fn(),
    },
  });
  const groups = [
    group('shortlisted', 0, 210),
    group('drafts', 222, 236),
    group('ready', 470, 290, true),
    group('applied', 772, 240),
  ];
  const manager = {
    dragOperation: { target: null, position: { current: { x: 625, y: 100 } } },
    registry: { droppables: groups },
    actions: { move: vi.fn() },
  };
  const sensor = Object.create(TestSensor.prototype) as TestSensor;
  sensor.manager = manager as unknown as DragDropManager;
  const event = { preventDefault: vi.fn() } as unknown as KeyboardEvent;
  return { sensor, manager, groups, event };
}

describe('keyboard group navigation', () => {
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
  it('jumps left to the nearest available group using its actual width', () => {
    const { sensor, manager, groups, event } = fixture();
    sensor.moveGroup('left', event);
    expect(manager.actions.move).toHaveBeenCalledWith({ event, to: { x: 340, y: 300 } });
    expect(groups[1].element.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'instant',
    });
  });
  it('skips blocked groups and leaves boundary moves alone', () => {
    const { sensor, manager, event } = fixture();
    manager.dragOperation.position.current.x = 105;
    sensor.moveGroup('right', event);
    expect(manager.actions.move).toHaveBeenLastCalledWith({ event, to: { x: 340, y: 300 } });
    manager.dragOperation.position.current.x = 340;
    sensor.moveGroup('right', event);
    expect(manager.actions.move).toHaveBeenLastCalledWith({ event, to: { x: 892, y: 300 } });
    manager.actions.move.mockClear();
    manager.dragOperation.position.current.x = 892;
    sensor.moveGroup('right', event);
    expect(manager.actions.move).not.toHaveBeenCalled();
  });
});
