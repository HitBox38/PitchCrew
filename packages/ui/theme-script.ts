import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transformWithOxc, type Plugin } from 'vite';

/** Keep theme initialization parser-blocking, before styles and the React entry. */
export const themeScript = (): Plugin => {
  const filename = fileURLToPath(new URL('./src/theme-init.ts', import.meta.url));
  const compile = async () =>
    (await transformWithOxc(await readFile(filename, 'utf8'), filename)).code;
  return {
    name: 'pitchcrew-theme-script',
    transformIndexHtml: {
      order: 'post',
      handler: () => [{ tag: 'script', attrs: { src: '/theme.js' }, injectTo: 'head-prepend' }],
    },
    configureServer: (server) => {
      server.middlewares.use('/theme.js', (_request, response, next) => {
        void compile().then((code) => {
          response.setHeader('Content-Type', 'text/javascript');
          response.setHeader('Cache-Control', 'no-cache');
          response.end(code);
        }, next);
      });
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'theme.js', source: await compile() });
    },
  };
};
