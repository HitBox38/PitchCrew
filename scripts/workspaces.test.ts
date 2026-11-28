import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import metadata from '../package.json' with { type: 'json' };
import landing from '../packages/landing/vercel.json' with { type: 'json' };
import { workspaces } from './workspace-manifests.ts';

const root = new URL('../', import.meta.url);

test('published package metadata and deployment tools agree with the release pins', () => {
  const bunVersion = readFileSync(new URL('.bun-version', root), 'utf8').trim();
  assert.equal(metadata.engines.bun, bunVersion);
  assert.equal(metadata.packageManager, `bun@${bunVersion}`);
  for (const command of [landing.installCommand, landing.buildCommand])
    assert.ok(command.split(/\s+/).includes(metadata.packageManager), command);
  for (const manifest of workspaces)
    assert.equal(manifest.version, metadata.version, manifest.name);
});

test('declared workspace dependencies, including desktop build dependencies, are acyclic', () => {
  const byName = new Map(workspaces.map((manifest) => [manifest.name, manifest]));
  const checked = new Set<string>();
  const visit = (name: string, parents: string[]) => {
    if (checked.has(name)) return;
    assert.ok(!parents.includes(name), [...parents, name].join(' -> '));
    for (const dependency of byName.get(name)!.dependencies)
      if (byName.has(dependency)) visit(dependency, [...parents, name]);
    checked.add(name);
  };
  for (const name of byName.keys()) visit(name, []);
});
