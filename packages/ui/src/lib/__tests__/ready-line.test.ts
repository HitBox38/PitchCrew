import { describe, expect, it } from 'vitest';
import type { Snapshot, WorkspaceQueue } from '@pitchcrew/core';
import { attentionItems } from '../attention.ts';
import { lineWords, readyLine } from '../ready-line.ts';
import {
  brief,
  card,
  delivery,
  queue,
  request,
  roles,
  run,
  snapshot,
  task,
} from './attention-fixture.ts';
import { installed, runtime, waiting } from './crew-lens-fixture.ts';

/** The line as `[queue id, place]`, on a snapshot whose agents' runtime is installed. */
const line = (fields: Partial<Snapshot>) => {
  const data = installed(snapshot(fields));
  return readyLine(data, attentionItems(data)).map((entry) => [entry.queue.id, entry.place]);
};
const slots = (active: number, concurrency: number, queues: WorkspaceQueue['queues']) => ({
  queue: { concurrency, active, background: 0, queues },
});
/** A queue whose run holds its slot. */
const busy = (id: string) =>
  queue(`job:${id}`, { state: 'running', runs: [run(`run-${id}`, { cardId: id })] });
/** A ready queue whose head delivery was reserved by the drain: its run does not exist yet. */
const launching = (id: string) =>
  queue(`job:${id}`, {
    requests: [
      request(`fit-${id}`, { boardAction: 'fit', deliveries: [delivery('scout', 'running')] }),
    ],
  });
/** A ready queue holding a crew follow-up that a completed run queued, before its next request. */
const followUp = (id: string) => ({
  ...waiting(id),
  tasks: [task(`task-${id}`, { cardId: id, roleId: 'writer' })],
});

describe('The waiting line', () => {
  it('starts what free slots allow, skips a queue behind a brief and counts the rest', () => {
    const quill = card('quill', { state: 'shortlisted', applicationContext: brief() });
    expect(
      line({
        cards: [quill],
        ...slots(4, 5, [
          queue('job:a'),
          queue('job:quill', {
            requests: [request('draft-quill', { boardAction: 'draft' })],
          }),
          queue('job:b'),
          queue('job:c', { state: 'running' }),
          queue('job:d'),
        ]),
      }),
    ).toEqual([
      ['job:a', 'starting'],
      ['job:quill', 'brief'],
      ['job:b', 1],
      ['job:d', 2],
    ]);
    expect([1, 2, 3, 11, 21].map(lineWords)).toEqual([
      'next in line',
      '2nd in line',
      '3rd in line',
      '11th in line',
      '21st in line',
    ]);
  });

  it('leaves out a queue whose next request its agent cannot start, counting the rest without it', () => {
    // Scout is paused: its fits never take a slot, so Writer's draft is next, not third.
    const paused = roles.map((role) => (role.id === 'scout' ? { ...role, enabled: false } : role));
    const queues = [
      busy('halcyon'),
      waiting('north'),
      waiting('kestrel', 'writer'),
      waiting('tide'),
      waiting('pine', 'reviewer'),
    ];
    expect(line({ roles: paused, ...slots(1, 1, queues) })).toEqual([
      ['job:kestrel', 1],
      ['job:pine', 2],
    ]);
    // Nor does a free slot go to it: the next queue its agent can start takes it.
    expect(line({ roles: paused, ...slots(1, 2, queues) })).toEqual([
      ['job:kestrel', 'starting'],
      ['job:pine', 1],
    ]);
    // Its agent's runtime missing holds it the same way.
    const data = snapshot({ ...slots(1, 1, queues), runtimes: [] });
    expect(readyLine(data, attentionItems(data))).toEqual([]);
    // So does a runtime that cannot isolate the application work a board action runs.
    const onGemini = roles.map((role) =>
      role.id === 'scout' ? { ...role, runtime: 'gemini-cli' as const } : role,
    );
    const gemini = { ...runtime('gemini-cli'), applicationIsolation: false };
    expect(
      line({ roles: onGemini, runtimes: [runtime('demo'), gemini], ...slots(1, 1, queues) }),
    ).toEqual([
      ['job:kestrel', 1],
      ['job:pine', 2],
    ]);
  });

  it('gives a launch under way its own slot, so the queues after it keep their true places', () => {
    // Three slots: two runs and a launch the drain reserved before its run exists.
    expect(
      line(slots(3, 3, [busy('halcyon'), busy('acme'), launching('lumen'), waiting('north')])),
    ).toEqual([
      ['job:lumen', 'starting'],
      ['job:north', 1],
    ]);
    // With a slot still free, the next queue starts in it.
    expect(
      line(
        slots(3, 4, [
          busy('halcyon'),
          busy('acme'),
          launching('lumen'),
          waiting('north'),
          waiting('kestrel'),
        ]),
      ),
    ).toEqual([
      ['job:lumen', 'starting'],
      ['job:north', 'starting'],
      ['job:kestrel', 1],
    ]);
    const data = installed(snapshot(slots(1, 1, [launching('lumen')])));
    expect(readyLine(data, [])[0]).toMatchObject({ place: 'starting', holdsSlot: true });
  });

  it('keeps a completed run’s crew follow-up in the slot its chain holds', () => {
    // Two slots: Halcyon's run, and Globex's chain, kept for the follow-up its finished run queued.
    expect(line(slots(2, 2, [busy('halcyon'), followUp('globex'), waiting('north')]))).toEqual([
      ['job:globex', 'starting'],
      ['job:north', 1],
    ]);
    // After a restart the chain is gone and both slots are taken by runs: the follow-up waits too.
    expect(
      line(slots(2, 2, [busy('halcyon'), busy('acme'), followUp('globex'), waiting('north')])),
    ).toEqual([
      ['job:globex', 1],
      ['job:north', 2],
    ]);
    // A launch holds its own slot and never lends it to a follow-up whose chain is gone.
    expect(line(slots(2, 2, [busy('halcyon'), launching('lumen'), followUp('globex')]))).toEqual([
      ['job:lumen', 'starting'],
      ['job:globex', 1],
    ]);
  });

  it('puts a held slot before a brief, and a brief before an agent that cannot start', () => {
    const quill = card('quill', { state: 'shortlisted', applicationContext: brief() });
    const draft = request('draft-quill', {
      boardAction: 'draft',
      deliveries: [delivery('writer', 'queued')],
    });
    const pause = (id: string) =>
      roles.map((role) => (role.id === id ? { ...role, enabled: false } : role));
    // Writer is paused and Quill Studio's draft waits behind its brief: the brief is what the user
    // acts on first, as the lens and the Queue cell show it.
    expect(
      line({
        cards: [quill],
        roles: pause('writer'),
        ...slots(1, 1, [busy('halcyon'), queue('job:quill', { requests: [draft] })]),
      }),
    ).toEqual([['job:quill', 'brief']]);
    // A chain that holds its slot starts the follow-up first, whatever the next request waits on.
    const quillFollowUp = queue('job:quill', {
      requests: [draft],
      tasks: [task('task-quill', { cardId: 'quill', roleId: 'writer' })],
    });
    expect(line({ cards: [quill], ...slots(2, 2, [busy('halcyon'), quillFollowUp]) })).toEqual([
      ['job:quill', 'starting'],
    ]);
    expect(
      line({ roles: pause('scout'), ...slots(2, 2, [busy('halcyon'), followUp('north')]) }),
    ).toEqual([['job:north', 'starting']]);
  });
});
