import type { NextConfig } from 'next';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { qualities: [85] },
  turbopack: { root },
  outputFileTracingRoot: root,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: '/relay/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      { source: '/relay/:path*', destination: 'https://eu.i.posthog.com/:path*' },
    ];
  },
};

export default nextConfig;
