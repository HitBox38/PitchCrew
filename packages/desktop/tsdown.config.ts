import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: { main: 'src/main.ts', 'build-icon': '../../scripts/build-icon.ts' },
    format: 'esm',
    outDir: 'dist',
    dts: false,
    deps: { neverBundle: ['electron'], alwaysBundle: ['ws', /^zod(?:\/|$)/] },
  },
  {
    // Sandboxed Electron preloads must be CommonJS, even though the host uses ESM.
    entry: ['src/preload.ts', 'src/browser-floating-preload.ts'],
    format: 'cjs',
    outDir: 'dist',
    clean: false,
    dts: false,
    deps: { neverBundle: ['electron'] },
  },
]);
