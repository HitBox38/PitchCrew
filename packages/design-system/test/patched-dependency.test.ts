import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readJson = (url: URL) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));

const rootUrl = new URL('../../../package.json', import.meta.url);
const root = readJson(rootUrl);
const designSystem = readJson(new URL('../package.json', import.meta.url));

const patchPrefix = '@shadcn/react@';
const patchKeys = Object.keys(root.patchedDependencies ?? {}).filter((key) =>
  key.startsWith(patchPrefix),
);
const patchedVersion = (patchKeys[0] ?? '').slice(patchPrefix.length);

describe('patched @shadcn/react dependency', () => {
  it('has exactly one root patch entry whose patch file exists', () => {
    expect(patchKeys, 'keep one patchedDependencies entry for @shadcn/react').toHaveLength(1);
    const patchPath = join(dirname(fileURLToPath(rootUrl)), root.patchedDependencies[patchKeys[0]]);
    expect(existsSync(patchPath), `missing patch file ${patchPath}`).toBe(true);
  });

  it('declares the exact @shadcn/react version the patch targets', () => {
    expect(
      designSystem.dependencies['@shadcn/react'],
      `pin packages/design-system to "${patchedVersion}" (no range) or regenerate the patch with bun patch`,
    ).toBe(patchedVersion);
  });

  it('installs the exact @shadcn/react version the patch targets, with the patch applied', () => {
    const require = createRequire(import.meta.url);
    const entry = require.resolve('@shadcn/react/message-scroller');
    expect(
      readFileSync(entry, 'utf8'),
      'the installed message scroller lacks the patched keepPreviousPeek option; reinstall with bun install',
    ).toContain('keepPreviousPeek');
    const installed = readJson(
      new URL(`file://${join(dirname(entry), '..', '..', 'package.json')}`),
    );
    expect(installed.version).toBe(patchedVersion);
  });
});
