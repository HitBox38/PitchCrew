import { globSync, readFileSync } from 'node:fs';
import { dirname, sep } from 'node:path';
import metadata from '../package.json' with { type: 'json' };

const root = new URL('../', import.meta.url);
interface WorkspaceManifest {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export const workspaces = globSync(
  metadata.workspaces.map((glob) => `${glob}/package.json`),
  {
    cwd: root,
  },
).map((file) => {
  const manifest = JSON.parse(readFileSync(new URL(file, root), 'utf8')) as WorkspaceManifest;
  return {
    directory: dirname(file).split(sep).join('/'),
    name: manifest.name,
    version: manifest.version,
    // Desktop bundles its workspace imports from devDependencies when building the installer host.
    dependencies: new Set(
      Object.keys({
        ...manifest.dependencies,
        ...manifest.devDependencies,
        ...manifest.optionalDependencies,
        ...manifest.peerDependencies,
      }),
    ),
  };
});
