import { pathFor } from './paths.ts';
import type { ServiceSpec } from './types.ts';

/** Folders package managers add to PATH only while a script runs, such as node_modules/.bin. */
const scriptOnly = /(^|[\\/])(node_modules|_npx|node-gyp-bin)([\\/]|$)/;

/**
 * PATH for macOS and Linux services. launchd and systemd start with a short default PATH, so the
 * installer's PATH is kept, with the daemon's Node folder first for CLIs that use `env node`.
 * Only PATH is copied; provider keys and other variables never enter a service definition.
 */
export function servicePath(spec: ServiceSpec) {
  const path = pathFor(spec.platform);
  const entries = [path.dirname(spec.node), ...spec.path.split(path.delimiter)].filter(
    (entry) => entry && path.isAbsolute(entry) && !scriptOnly.test(entry),
  );
  return [...new Set(entries)].join(path.delimiter);
}
