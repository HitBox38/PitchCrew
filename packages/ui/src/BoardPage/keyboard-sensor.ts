import { KeyboardSensor } from '@dnd-kit/dom';

/** Arrow keys move between available groups rather than nudging a card a few pixels. */
export class PipelineKeyboardSensor extends KeyboardSensor {
  protected override handleMove(direction: 'up' | 'down' | 'left' | 'right', event: KeyboardEvent) {
    event.preventDefault();
    const operation = this.manager.dragOperation;
    const current = operation.target?.element?.getBoundingClientRect();
    const x = current ? current.left + current.width / 2 : operation.position.current.x;
    const sign = direction === 'left' || direction === 'up' ? -1 : 1;
    const target = [...this.manager.registry.droppables]
      .filter((item) => !item.disabled && item.element && item.id !== operation.target?.id)
      .map((item) => ({ item, rect: item.element!.getBoundingClientRect() }))
      .filter(({ rect }) => (rect.left + rect.width / 2 - x) * sign > 1)
      .sort(
        (a, b) =>
          Math.abs(a.rect.left + a.rect.width / 2 - x) -
          Math.abs(b.rect.left + b.rect.width / 2 - x),
      )[0]?.item;
    if (!target?.element) return;
    target.element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    const rect = target.element.getBoundingClientRect();
    const viewportHeight =
      target.element.ownerDocument?.defaultView?.innerHeight ?? rect.top + rect.height;
    const top = Math.max(0, rect.top);
    const bottom = Math.min(viewportHeight, rect.top + rect.height);
    this.manager.actions.move({
      event,
      to: { x: rect.left + rect.width / 2, y: top + (bottom - top) / 2 },
    });
  }
}
