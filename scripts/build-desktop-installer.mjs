import { createRequire } from 'node:module';
import { build } from 'electron-builder';

// Fast compression keeps per-push builds bounded even with bundled Chromium.
process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL = '1';
const require = createRequire(import.meta.url);
await build({ config: require('../electron-builder.config.cjs'), publish: 'never' });
