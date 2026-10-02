import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/main.ts'],
    format: 'esm',
    outDir: 'dist',
    dts: false,
    deps: { neverBundle: ['electron'] },
  },
  {
    // Sandboxed Electron preloads must be CommonJS, even though the host uses ESM.
    entry: ['src/preload.ts'],
    format: 'cjs',
    outDir: 'dist',
    clean: false,
    dts: false,
    deps: { neverBundle: ['electron'] },
  },
]);
