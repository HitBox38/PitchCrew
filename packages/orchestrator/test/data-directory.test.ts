import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertDataDirectoryOutsideRepository } from '../src/data-directory.ts';

const root = resolve('fictional-workspace', 'repository');

describe('application data directory boundary', () => {
  it.each([
    ['repository root', root],
    ['ordinary repository child', join(root, 'private-data')],
    ['child whose name begins with two dots', join(root, '..private-data')],
    ['child whose name contains a colon', join(root, 'notes:private')],
  ])('rejects %s', (_name, directory) => {
    expect(() => assertDataDirectoryOutsideRepository(root, directory)).toThrow(
      'PITCHCREW_HOME must be outside the repository.',
    );
  });

  it.each([
    ['sibling directory', resolve(root, '..', 'private-data')],
    ['sibling sharing the repository name prefix', resolve(root, '..', 'repository-data')],
    ['parent directory', resolve(root, '..')],
  ])('accepts %s', (_name, directory) => {
    expect(() => assertDataDirectoryOutsideRepository(root, directory)).not.toThrow();
  });
});
