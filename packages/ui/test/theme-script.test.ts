import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { build, createServer } from 'vite';
import { expect, test } from 'vitest';
import { themeScript } from '../theme-script.ts';

const checkBootstrap = (html: string, script: string) => {
  expect(html).toContain('<script src="/theme.js"></script>');
  expect(html.indexOf('/theme.js')).toBeLessThan(html.indexOf('name="theme-color"'));
  for (const [choice, systemDark, expected] of [
    ['dark', false, 'dark'],
    ['light', true, 'light'],
    ['system', true, 'dark'],
    [null, false, 'light'],
    ['invalid', true, 'dark'],
  ] as const) {
    const document = { documentElement: { dataset: { theme: '' } } };
    runInNewContext(script, {
      document,
      localStorage: { getItem: () => choice },
      window: { matchMedia: () => ({ matches: systemDark }) },
    });
    expect(document.documentElement.dataset.theme).toBe(expected);
  }
  const document = { documentElement: { dataset: { theme: '' } } };
  runInNewContext(script, {
    document,
    localStorage: {
      getItem: () => {
        throw new Error('Storage unavailable');
      },
    },
    window: { matchMedia: () => ({ matches: true }) },
  });
  expect(document.documentElement.dataset.theme).toBe('dark');
};

test('development and production preserve the blocking theme bootstrap', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-theme-script-'));
  await writeFile(
    join(directory, 'index.html'),
    '<html><head><meta name="theme-color" content="#fff"></head><body></body></html>',
  );
  const server = await createServer({
    root: directory,
    configFile: false,
    plugins: [themeScript()],
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0 },
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === 'string') throw new Error('No test server address.');
    const origin = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${origin}/theme.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/javascript');
    checkBootstrap(await (await fetch(origin)).text(), await response.text());
    await server.close();
    await build({
      root: directory,
      configFile: false,
      plugins: [themeScript()],
      logLevel: 'silent',
    });
    checkBootstrap(
      await readFile(join(directory, 'dist/index.html'), 'utf8'),
      await readFile(join(directory, 'dist/theme.js'), 'utf8'),
    );
  } finally {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }
});
