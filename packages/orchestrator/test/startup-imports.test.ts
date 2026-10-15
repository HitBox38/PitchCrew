import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

it('starts and snapshots a workspace without initializing optional document or browser engines', async () => {
  const daemon = new URL('../src/server.ts', import.meta.url).href;
  const adapters = new URL('../../adapters/src/index.ts', import.meta.url).href;
  // Use a fresh Node process: the actual package graph includes workspace imports and CJS modules.
  // A resolve hook catches an eager dependency even when another test already loaded that package.
  const script = `
    import { registerHooks } from 'node:module';
    const optional = new Set(['pdf-lib', 'docx', '@pdf-lib/fontkit', 'playwright']);
    registerHooks({ resolve(specifier, context, next) {
      if (optional.has(specifier)) throw new Error('Startup eagerly loaded ' + specifier);
      return next(specifier, context);
    }});
    const { mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { createDaemon } = await import(${JSON.stringify(daemon)});
    const { adapters } = await import(${JSON.stringify(adapters)});
    for (const adapter of Object.values(adapters))
      adapter.detect = async () => ({ id: adapter.id, available: false, version: '', detail: '' });
    const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-startup-imports-'));
    let workspace;
    try {
      workspace = await createDaemon({ directory, port: 15010, seedSkills: false });
      const snapshot = await workspace.service.snapshot();
      if (snapshot.roles.length !== 7) throw new Error('Default roles missing.');
      console.log('daemon snapshot ready');
    } finally {
      await workspace?.close();
      await rm(directory, { recursive: true, force: true });
    }
  `;
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ['--import', fileURLToPath(import.meta.resolve('tsx')), '--input-type=module', '-e', script],
    { timeout: 15000 },
  );
  expect(stdout).toContain('daemon snapshot ready');
});
