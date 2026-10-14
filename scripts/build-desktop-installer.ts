import { build } from 'electron-builder';
import config from '../electron-builder.config.ts';

// Fast compression keeps per-push builds bounded even with bundled Chromium.
process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL = '1';
await build({ config, publish: 'never' });
