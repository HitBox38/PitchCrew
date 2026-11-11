import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  approvalLifecycle,
  cardLifecycle,
  defineLifecycle,
  deliveryLifecycle,
  LifecycleError,
  lifecycles,
  runLifecycle,
} from '../src/lifecycles.ts';
import { states, transitions } from '../src/states.ts';
import { renderStateMachines, stateMachinesPath } from '../../../scripts/state-machines.ts';

it('answers guards, next moves and final statuses from one table', () => {
  const door = defineLifecycle('Door', {
    initial: ['closed'],
    graph: { closed: ['open', 'locked'], open: ['closed'], locked: ['closed'], removed: [] },
    groups: { shut: ['closed', 'locked'] },
  });
  expect(door.states).toEqual(['closed', 'open', 'locked', 'removed']);
  expect(door.can('closed', 'open')).toBe(true);
  expect(door.can('open', 'locked')).toBe(false);
  // Saving without changing the status is not a move.
  expect(door.can('removed', 'removed')).toBe(true);
  expect(door.next('open')).toEqual(['closed']);
  expect(door.final).toEqual(['removed']);
  expect(door.isFinal('removed')).toBe(true);
  expect(door.canStart('open')).toBe(false);
  expect(door.is('shut', 'locked')).toBe(true);
  expect(door.is('shut', 'open')).toBe(false);
});

it('explains a refused move with the moves that are allowed', () => {
  expect(() => approvalLifecycle.assert('consumed', 'approved')).toThrow(LifecycleError);
  expect(() => approvalLifecycle.assert('consumed', 'approved')).toThrow(
    'Packet approval cannot go from consumed to approved. consumed is final.',
  );
  expect(() => runLifecycle.assert('completed', 'running')).toThrow('completed is final.');
  expect(() => deliveryLifecycle.assert('waiting', 'queued')).toThrow(
    'From waiting it can become: completed, failed, cancelled.',
  );
});

it('keeps every table closed over its own statuses', () => {
  for (const lifecycle of lifecycles) {
    const known = new Set(lifecycle.states);
    for (const state of lifecycle.initial) expect(known.has(state), lifecycle.name).toBe(true);
    for (const from of lifecycle.states) {
      expect(lifecycle.graph[from], `${lifecycle.name} ${from}`).not.toContain(from);
      for (const to of lifecycle.graph[from])
        expect(known.has(to), `${lifecycle.name} ${from} -> ${to}`).toBe(true);
    }
    for (const group of Object.values(lifecycle.groups))
      for (const state of group) expect(known.has(state), lifecycle.name).toBe(true);
    // Every status can be reached from a starting status.
    const reached = new Set(lifecycle.initial);
    for (const from of reached) for (const to of lifecycle.graph[from]) reached.add(to);
    expect(
      [...known].filter((state) => !reached.has(state)),
      lifecycle.name,
    ).toEqual([]);
  }
});

it('shares the job workflow graph with the board', () => {
  expect(cardLifecycle.graph).toBe(transitions);
  expect(cardLifecycle.states).toEqual([...states]);
  expect(
    [
      ...cardLifecycle.groups.preparing,
      ...cardLifecycle.groups.applied,
      ...cardLifecycle.groups.closed,
    ].toSorted(),
  ).toEqual([...states].toSorted());
});

it('keeps docs/state-machines.md generated from the tables', () => {
  expect(
    readFileSync(stateMachinesPath, 'utf8'),
    'Run `bun run docs:state-machines` after changing a lifecycle table.',
  ).toBe(renderStateMachines());
});
