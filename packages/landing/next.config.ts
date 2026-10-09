import type { NextConfig } from 'next';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { qualities: [85] },
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;
