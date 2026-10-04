import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

describe('physical application data directory boundary', () => {
  it('rejects a repository alias with a nonexistent data-directory suffix', () => {
    const temporary = mkdtempSync(join(tmpdir(), 'pitchcrew-path-boundary-'));
    try {
      const repository = join(temporary, 'repository');
      const alias = join(temporary, 'alias');
      mkdirSync(repository);
      symlinkSync(repository, alias, 'junction');
      expect(() =>
        assertDataDirectoryOutsideRepository(
          realpathSync(repository),
          join(alias, '..private-data', 'notes'),
        ),
      ).toThrow('PITCHCREW_HOME must be outside the repository.');
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it('allows a physical external directory with a nonexistent suffix', () => {
    const temporary = mkdtempSync(join(tmpdir(), 'pitchcrew-path-boundary-'));
    try {
      const repository = join(temporary, 'repository');
      const external = join(temporary, 'external-data');
      mkdirSync(repository);
      mkdirSync(external);
      expect(() =>
        assertDataDirectoryOutsideRepository(realpathSync(repository), join(external, 'notes')),
      ).not.toThrow();
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });
});
