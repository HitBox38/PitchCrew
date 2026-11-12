import { Board } from '@pitchcrew/board';
import type { Card, ChatMessage, Role } from '@pitchcrew/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { laterEvents, versionTwoEvents } from '../../board/test/fixtures/historical-events.ts';
import { createDaemon } from '../src/server.ts';
import { isolateRuntimes, reservePort, restoreRuntimes } from './helpers/daemon.ts';

const prefix = join(tmpdir(), 'pitchcrew-test-');
let resource: { daemon: Awaited<ReturnType<typeof createDaemon>>; directory: string } | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  restoreRuntimes();
  const current = resource;
  resource = undefined;
  if (!current) return;
  await current.daemon.close();
  if (resolve(current.directory).startsWith(resolve(prefix)))
    await rm(current.directory, { recursive: true, force: true });
});

it('opens a workspace made only of early-shape events without losing or rewriting history', async () => {
  const directory = await mkdtemp(prefix);
  const fixtures = [...versionTwoEvents, ...laterEvents];
  const board = new Board(join(directory, 'pitchcrew.db'));
  const rows = fixtures.map((fixture) => {
    const raw = JSON.stringify(fixture);
    return {
      id: board.db.prepare('INSERT INTO events(json) VALUES (?)').run(raw).lastInsertRowid,
      raw,
    };
  });
  board.rebuild();
  board.close();
  // Real initialization, without host-dependent CLI or model discovery.
  isolateRuntimes();
  const reservation = await reservePort();
  const { port } = reservation;
  reservation.release();
  const daemon = await createDaemon({ directory, port, dev: true, ui: false, seedSkills: false });
  resource = { daemon, directory };

  const snapshot = await daemon.service.snapshot();
  expect(snapshot.roles.map((role: Role) => role.id)).toEqual(
    expect.arrayContaining(['scout', 'writer', 'reviewer']),
  );
  const cards = new Map(snapshot.cards.map((card: Card) => [card.id, card]));
  expect(cards.get('historic-card-lead')?.state).toBe('lead');
  expect(cards.get('historic-card-agreed')?.state).toBe('agreed');
  for (const id of [
    'historic-message-scout',
    'historic-message-crew',
    'historic-message-attachment',
  ])
    expect(daemon.service.board.get<ChatMessage>('message', id).id).toBe(id);
  const threads = (snapshot.conversations ?? []).map((conversation) => conversation.id);
  expect(threads).toEqual(expect.arrayContaining(['scout', 'crew']));

  for (const row of rows)
    expect(
      (
        daemon.service.board.db.prepare('SELECT json FROM events WHERE id = ?').get(row.id) as {
          json: string;
        }
      ).json,
    ).toBe(row.raw);
});
