import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: ['src/main.ts'],
  format: 'esm',
  outDir: 'dist',
  dts: false,
  deps: { neverBundle: ['electron'] },
});
