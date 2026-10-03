import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [mode, source, directory, port] = process.argv.slice(2);
const root = resolve(source);
const load = (path) => import(pathToFileURL(join(root, path)).href);

if (mode === 'seed') {
  const { Board } = await load('packages/board/src/index.ts');
  const { cardInput } = await load('packages/core/src/index.ts');
  await mkdir(join(directory, 'profile'), { recursive: true });
  for (const name of ['experience.md', 'projects.md']) {
    await writeFile(
      join(directory, 'profile', name),
      '# Fictional candidate\n\n' +
        'Built fictional scheduling interfaces with React and TypeScript.\n'.repeat(20),
    );
  }
  const board = new Board(join(directory, 'pitchcrew.db'));
  try {
    board.seedRoles();
    for (let i = 0; i < 100; i++) {
      board.createCard(
        cardInput.parse({
          company: `Fictional Company ${i.toString().padStart(3, '0')}`,
          title: 'Product Engineer',
          description:
            'Fictional opening: build accessible scheduling interfaces and document reusable components. '.repeat(
              10,
            ),
          tags: ['React', 'TypeScript'],
        }),
      );
    }
    for (let i = 0; i < 200; i++) {
      board.record(
        'message',
        {
          id: `00000000-0000-4000-8000-${i.toString().padStart(12, '0')}`,
          threadId: 'scout',
          from: 'scout',
          to: 'user',
          cardId: null,
          runId: null,
          content: `Fictional saved message ${i}: review the evidence and prioritize suitable openings.`,
          createdAt: '2026-10-04T00:00:00.000Z',
        },
        'scout',
        'Fictional benchmark message',
      );
    }
  } finally {
    board.close();
  }
} else if (mode === 'serve') {
  const { createDaemon } = await load('packages/orchestrator/src/server.ts');
  const daemon = await createDaemon({ directory, port: Number(port), seedSkills: false });
  await new Promise((resolve, reject) => {
    daemon.http.once('error', reject);
    daemon.http.listen(Number(port), '127.0.0.1', resolve);
  });
  process.send({ type: 'ready', url: daemon.url });
  process.on('message', (message) => {
    if (message.type === 'memory')
      process.send({ type: 'memory', id: message.id, ...process.memoryUsage() });
  });
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await daemon.close();
    process.exit(0);
  };
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
} else {
  throw new Error('Expected seed or serve mode.');
}
