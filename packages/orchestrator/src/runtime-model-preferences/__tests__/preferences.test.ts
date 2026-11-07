import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import {
  defaultRuntimeModelPreferences,
  type Conversation,
  type Role,
  type RuntimeModelPreferences,
  type RuntimeModelCatalog,
} from '@pitchcrew/core';
import type { Board } from '@pitchcrew/board';
import { RuntimeModelPreferencesStore, RuntimeModelPreferencesReadError } from '../store.ts';
import { assertCustomModelsUnused } from '../usage.ts';
import { runtimeModelsWithCustomDefinitions } from '../index.ts';

const directories: string[] = [];
const temporary = () => {
  const value = mkdtempSync(join(tmpdir(), 'pitchcrew-model-preferences-'));
  directories.push(value);
  return value;
};

test('keeps native catalog and reasoning available without replacing unreadable custom definitions', () => {
  const directory = temporary();
  const store = new RuntimeModelPreferencesStore(directory);
  const damaged = '{fictional damaged model choices';
  writeFileSync(store.path, damaged);
  const catalog: RuntimeModelCatalog = {
    models: [{ value: 'native', label: 'Native', reasoning: { levels: ['low', 'high'] } }],
    modelSource: 'runtime' as const,
    modelDetail: 'Fictional native catalog',
  };
  const result = runtimeModelsWithCustomDefinitions(directory, 'codex', catalog);
  expect(result).toBe(catalog);
  expect(() => store.current('codex')).toThrow(RuntimeModelPreferencesReadError);
  expect(() => store.save('codex', defaultRuntimeModelPreferences(), '0'.repeat(64))).toThrow(
    RuntimeModelPreferencesReadError,
  );
  expect(result.models.find((model) => model.value === 'missing-custom')).toBeUndefined();
  expect(readFileSync(store.path, 'utf8')).toBe(damaged);
});
afterEach(() => {
  for (const directory of directories.splice(0)) {
    if (
      !resolve(directory).startsWith(resolve(tmpdir()) + sep) ||
      !directory.startsWith(join(tmpdir(), 'pitchcrew-model-preferences-'))
    )
      throw new Error('Unsafe fixture cleanup path.');
    rmSync(directory, { recursive: true, force: true });
  }
});

test('persists workspace choices separately and rejects stale writes without replacing another runtime', () => {
  const store = new RuntimeModelPreferencesStore(temporary());
  const codex = store.current('codex');
  const claude = store.current('claude-code');
  store.save('codex', { ...codex.preferences, hidden: ['fixture-model'] }, codex.revision);
  store.save(
    'claude-code',
    { ...claude.preferences, favorite: ['fixture-other'] },
    claude.revision,
  );
  expect(store.current('codex').preferences.hidden).toEqual(['fixture-model']);
  expect(store.current('claude-code').preferences.favorite).toEqual(['fixture-other']);
  expect(() => store.save('codex', codex.preferences, codex.revision)).toThrow('changed elsewhere');
  expect(readFileSync(store.path, 'utf8')).not.toMatch(/credential|token|password/);
  expect(() => store.save('demo', codex.preferences, codex.revision)).toThrow('Demo has no model');
});

test('merges custom metadata for backend validation without hiding a saved model', () => {
  const directory = temporary();
  const store = new RuntimeModelPreferencesStore(directory);
  const current = store.current('codex');
  store.save(
    'codex',
    {
      ...current.preferences,
      hidden: ['fixture-custom'],
      custom: [
        { value: 'fixture-custom', label: 'Fixture custom', reasoning: { levels: ['high'] } },
      ],
    },
    current.revision,
  );
  const result = runtimeModelsWithCustomDefinitions(directory, 'codex', {
    models: [],
    modelSource: 'fallback',
    modelDetail: 'Suggestions',
  });
  expect(result.models).toEqual([
    {
      value: 'fixture-custom',
      label: 'Fixture custom',
      custom: true,
      reasoning: { levels: ['high'] },
    },
  ]);
  expect(result.modelSource).toBe('fallback');
});

test('blocks destructive definition edits for saved agents and inherited conversation overrides', () => {
  const current: RuntimeModelPreferences = {
    ...defaultRuntimeModelPreferences(),
    custom: [{ value: 'custom', label: 'Custom', reasoning: { levels: ['low', 'high'] } }],
  };
  const next: RuntimeModelPreferences = {
    ...defaultRuntimeModelPreferences(),
    custom: [{ value: 'custom', label: 'Renamed', reasoning: { levels: ['low'] } }],
  };
  const role = { id: 'writer', runtime: 'codex', model: 'custom', reasoning: 'high' } as Role;
  const conversation = {
    configurations: { writer: { model: 'custom', reasoning: 'high' } },
  } as unknown as Conversation;
  const board = { list: (kind: string) => (kind === 'role' ? [role] : []) } as unknown as Board;
  expect(() => assertCustomModelsUnused(board, 'codex', current, next)).toThrow(
    'still used by an agent',
  );
  const inherited = {
    list: (kind: string) =>
      kind === 'role' ? [{ ...role, model: 'native', reasoning: null }] : [conversation],
  } as unknown as Board;
  expect(() => assertCustomModelsUnused(inherited, 'codex', current, next)).toThrow(
    'still used by a conversation',
  );
  expect(() =>
    assertCustomModelsUnused(board, 'codex', current, { ...current, hidden: ['custom'] }),
  ).not.toThrow();
});
