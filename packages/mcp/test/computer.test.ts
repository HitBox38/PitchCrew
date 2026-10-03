import { digestPacket, Board } from '@pitchcrew/board';
import { type BrowserSnapshot, type ComputerApproval, browserActionSchema } from '@pitchcrew/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { ComputerManager, assertPublicUrl, publicAddress } from '../src/computer.ts';

const resources: { board: Board; manager: ComputerManager; directory: string }[] = [];
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-computer-test-'));
  const board = new Board(join(directory, 'board.db'));
  const page: BrowserSnapshot = {
    url: 'https://example.com/apply',
    title: 'Fixture form',
    text: 'Name Submit',
    screenshot: '',
    digest: 'initial-page',
  };
  const driver = {
    snapshot: vi.fn(async () => ({ ...page })),
    perform: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  const manager = new ComputerManager(board, directory, async () => driver);
  resources.push({ board, manager, directory });
  const scope = { runId: 'fixture-run', roleId: 'writer' as const, cardId: null };
  return {
    board,
    manager,
    driver,
    page,
    scope,
    signal: new AbortController().signal,
    authorize: vi.fn(),
  };
}
afterEach(async () => {
  for (const { board, manager, directory } of resources.splice(0)) {
    await manager.close();
    board.close();
    await rm(directory, { recursive: true, force: true });
  }
});
it('does not interact until approved, binds one action to one run and consumes it once', async () => {
  const { board, manager, driver, scope, signal, authorize } = await setup();
  const approval = await manager.request(
    scope,
    { kind: 'click', selector: '#submit' },
    'Submit the reviewed fixture',
  );
  expect(driver.perform).not.toHaveBeenCalled();
  expect(await manager.execute(scope.runId, approval.id, signal, authorize, 0)).toMatchObject({
    status: 'pending',
  });
  await expect(manager.execute('another-run', approval.id, signal, authorize, 0)).rejects.toThrow(
    'another run',
  );
  manager.decide(approval.id, true);
  expect(await manager.execute(scope.runId, approval.id, signal, authorize, 0)).toMatchObject({
    status: 'consumed',
  });
  expect(driver.perform).toHaveBeenCalledExactlyOnceWith(approval.action, undefined);
  await expect(manager.execute(scope.runId, approval.id, signal, authorize, 0)).rejects.toThrow(
    'consumed',
  );
  board.rebuild();
  expect(board.get<ComputerApproval>('computer_approval', approval.id).status).toBe('consumed');
  expect(board.events()[0].version).toBe(9);
});
it('rejects changed pages and revocation, and never reuses a failed action', async () => {
  const { board, manager, driver, scope, page, signal, authorize } = await setup();
  const approval = await manager.request(
    scope,
    { kind: 'fill', selector: '#name', value: 'Fixture Person' },
    'Enter name',
  );
  manager.decide(approval.id, true);
  page.digest = 'changed-page';
  await expect(manager.execute(scope.runId, approval.id, signal, authorize, 0)).rejects.toThrow(
    'page changed',
  );
  expect(driver.perform).not.toHaveBeenCalled();
  expect(board.get<ComputerApproval>('computer_approval', approval.id).status).toBe('failed');
  const next = await manager.request(scope, { kind: 'click', selector: '#next' }, 'Next');
  manager.decide(next.id, true);
  driver.perform.mockRejectedValueOnce(new Error('Unknown click outcome'));
  await expect(manager.execute(scope.runId, next.id, signal, authorize, 0)).rejects.toThrow(
    'Unknown click outcome',
  );
  await expect(manager.execute(scope.runId, next.id, signal, authorize, 0)).rejects.toThrow(
    'failed',
  );
  const revoked = await manager.request(scope, { kind: 'click', selector: '#next' }, 'Next');
  manager.decide(revoked.id, true);
  await expect(
    manager.execute(
      scope.runId,
      revoked.id,
      signal,
      () => {
        throw new Error('Revoked');
      },
      0,
    ),
  ).rejects.toThrow('Revoked');
  expect(driver.perform).toHaveBeenCalledTimes(1);
});
it('rejects decisions after run end and aborts waiting without acting', async () => {
  const { manager, driver, scope, authorize } = await setup();
  const approval = await manager.request(scope, { kind: 'click', selector: '#submit' }, 'Submit');
  const controller = new AbortController();
  const waiting = manager.execute(scope.runId, approval.id, controller.signal, authorize);
  controller.abort();
  await expect(waiting).rejects.toThrow();
  await manager.stop(scope.runId);
  expect(driver.close).toHaveBeenCalledOnce();
  expect(driver.perform).not.toHaveBeenCalled();
  expect(() => manager.decide(approval.id, true)).toThrow('no longer pending');
  await expect(manager.inspect(scope.runId)).rejects.toThrow('ended');
});
it('rejects arbitrary filesystem/JS actions and local/private navigation', async () => {
  expect(
    browserActionSchema.safeParse({ kind: 'navigate', url: 'file:///etc/passwd' }).success,
  ).toBe(false);
  expect(browserActionSchema.safeParse({ kind: 'evaluate', code: 'fetch(...)' }).success).toBe(
    false,
  );
  expect(
    browserActionSchema.safeParse({ kind: 'upload', selector: '#file', path: '/etc/passwd' })
      .success,
  ).toBe(false);
  for (const address of [
    '127.0.0.1',
    '10.1.2.3',
    '192.168.1.1',
    '169.254.169.254',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
  ])
    expect(publicAddress(address)).toBe(false);
  expect(publicAddress('8.8.8.8')).toBe(true);
  expect(publicAddress('2606:4700:4700::1111')).toBe(true);
  await expect(assertPublicUrl('http://127.0.0.1:4417')).rejects.toThrow('private network');
  await expect(assertPublicUrl('http://localhost:4417')).rejects.toThrow('private network');
});

it('uploads only the exact reviewed exported bytes for the attached card', async () => {
  const { manager, driver, scope, board, signal, authorize } = await setup();
  const { writePacket } = await import('@pitchcrew/packet');
  const { packet } = await import('../../board/test/fixtures/packet.ts');
  const { writeFile } = await import('node:fs/promises');
  const { cardInput } = await import('@pitchcrew/core');
  const { randomUUID } = await import('node:crypto');
  const card = board.createCard(cardInput.parse({ company: 'Fixture Studio', title: 'Engineer' }));
  const directory = resources.at(-1)!.directory;
  board.updateCard(card.id, { packet }, 'user', 'Reviewed fixture packet');
  const output = await writePacket(directory, card.id, packet);
  const exported = {
    id: randomUUID(),
    cardId: card.id,
    action: 'export_packet' as const,
    digest: digestPacket(card.id, packet),
    packet,
    status: 'consumed' as const,
    createdAt: '',
    decidedAt: '',
    exportDirectory: output,
  };
  board.record('approval', exported, 'mcp', 'Fixture exported packet');
  const action = {
    kind: 'upload',
    selector: '#resume',
    exportApprovalId: exported.id,
    file: 'resume.md',
  };
  await expect(manager.request(scope, action, 'Upload fixture')).rejects.toThrow('for this card');
  const approved = await manager.request({ ...scope, cardId: card.id }, action, 'Upload fixture');
  expect(approved.uploadContent).toBe(packet.resume);
  manager.decide(approved.id, true);
  await manager.execute(scope.runId, approved.id, signal, authorize, 0);
  expect(driver.perform).toHaveBeenCalledWith(approved.action, {
    name: 'resume.md',
    buffer: Buffer.from(packet.resume),
  });
  const changed = await manager.request(
    { ...scope, cardId: card.id },
    action,
    'Upload fixture again',
  );
  manager.decide(changed.id, true);
  await writeFile(join(output, 'resume.md'), 'Unreviewed content');
  await expect(manager.execute(scope.runId, changed.id, signal, authorize, 0)).rejects.toThrow(
    'exported file changed',
  );
  expect(driver.perform).toHaveBeenCalledTimes(1);
});
