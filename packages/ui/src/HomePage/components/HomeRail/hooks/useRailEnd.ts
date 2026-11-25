import { useEffect, useState } from 'react';

/** A block's heading: a rest never ends under one without the row that follows it. */
const head = '.home-block-head';
/** The rows a rest position of the pinned rail may start at (their tops snap to its top edge). */
const stops = `${head}, .home-run, .home-next, .home-note, .home-rest, .home-crew, .home-stage`;
/** Every line the rail's foot must never cut: its rows, and the lines between them. */
const lines = `${head}, .home-run, .home-next, .home-note, .home-rest-trigger, .home-crew, .home-stage, .home-empty, .home-paused, .home-rest-queue`;
/** A glyph's ink sits a few pixels inside its line's box, so a box shaved by less shows no cut. */
const ink = 2;
/** The most height a whole-row rest may give up; past that the rail keeps its whole room. */
const most = 160;

/** A line inside the rail's scrolling content, from the content's top; `head` marks a heading. */
export type RailLine = { top: number; bottom: number; head: boolean };

/**
 * Where the rail's rows sit inside its scrolling content, measured from the content's top.
 */
const boxes = (rail: HTMLElement, selector: string): RailLine[] => {
  const origin = rail.getBoundingClientRect().top + rail.clientTop - rail.scrollTop;
  return [...rail.querySelectorAll<HTMLElement>(selector)]
    .filter((row) => row.getClientRects().length)
    .map((row) => {
      const box = row.getBoundingClientRect();
      return { top: box.top - origin, bottom: box.bottom - origin, head: row.matches(head) };
    });
};

/**
 * Where the rail's resting view should end, scrolled to the top (`room` is its full height), or
 * undefined to keep its whole room: between rows, never through a line, an avatar or a bead, and
 * never under a block's heading without its first row ("Pipeline 114 open" alone), since a heading
 * and the line after it count as one. It gives up only what the view would cut and the gap above
 * it, never more than `most`.
 */
export const restEnd = (rows: readonly RailLine[], room: number) => {
  const units = rows.map((row, index) => {
    const first = row.head ? rows[index + 1] : undefined;
    return first ? { top: row.top, bottom: first.bottom } : row;
  });
  const whole = (end: number) =>
    !units.some((unit) => unit.top < end - ink && unit.bottom > end + ink);
  if (whole(room)) return undefined;
  const end = Math.max(
    0,
    ...units.map((unit) => Math.ceil(unit.bottom)).filter((at) => at <= room && whole(at)),
  );
  return end < room - most ? undefined : end;
};

/**
 * Sizes the rail so its resting view, scrolled to the top, ends on a whole row: its scroll edge
 * (the top of its 12px foot) falls where `restEnd` puts it.
 */
const fitRoom = (rail: HTMLElement) => {
  const room = rail.clientHeight;
  const end = restEnd(boxes(rail, lines), room);
  if (end !== undefined)
    rail.style.setProperty('--rail-room', `${end + rail.offsetHeight - room}px`);
};

/**
 * Pads the end of the pinned rail just enough that its last rest position also starts a whole row
 * at the top edge, as its snapped rest positions do, so scrolled to the end the edge never slices
 * a line, an avatar or a bead.
 */
const fitEnd = (rail: HTMLElement) => {
  const natural = rail.scrollHeight - rail.clientHeight;
  const padding = Number.parseFloat(getComputedStyle(rail).scrollPaddingTop) || 0;
  const next = boxes(rail, stops)
    .map((row) => row.top - padding)
    .filter((stop) => stop > natural - 0.5)
    .reduce((first, stop) => Math.min(first, stop), Number.POSITIVE_INFINITY);
  if (Number.isFinite(next) && next - natural > 0.5)
    rail.style.setProperty('--rail-end', `${Math.ceil(next - natural)}px`);
};

/**
 * Lands both rests of the pinned rail on whole rows: its height ends its first view between rows
 * (`--rail-room`), and its end padding starts its last view on one (`--rail-end`). Rows differ in
 * height, so both are measured; they are set only while the rail scrolls on its own, and measured
 * again whenever the rail, a block or the work area resizes.
 */
export const useRailEnd = () => {
  const [rail, setRail] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!rail) return;
    const fit = () => {
      rail.style.removeProperty('--rail-room');
      rail.style.removeProperty('--rail-end');
      const scrolls = getComputedStyle(rail).overflowY !== 'visible';
      if (!scrolls || rail.scrollHeight <= rail.clientHeight) return;
      fitRoom(rail);
      fitEnd(rail);
    };
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    const sizes = new ResizeObserver(later);
    sizes.observe(rail);
    for (const block of rail.querySelectorAll('.home-block')) sizes.observe(block);
    const area = rail.closest('.workspace-body');
    if (area) sizes.observe(area);
    fit();
    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      rail.style.removeProperty('--rail-room');
      rail.style.removeProperty('--rail-end');
    };
  }, [rail]);
  return setRail;
};
