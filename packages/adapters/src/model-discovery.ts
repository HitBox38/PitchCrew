import type { RuntimeAdapter, RuntimeModel, RuntimeModelCatalog } from '@pitchcrew/core';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify, stripVTControlCharacters } from 'node:util';
import { modelReasoning, piReasoning } from './reasoning.ts';
import { cliEnvironment } from './process.ts';

const exec = promisify(execFile);
export const modelDiscoveryTimeout = 10000;
export const modelDiscoveryMaxBytes = 2_000_000;

// Only native model-list operations belong here. Never start a turn or inspect auth files.
export async function modelListCommand(
  command: string,
  args: string[],
  signal?: AbortSignal,
): Promise<string> {
  const result = exec(command, args, {
    cwd: tmpdir(),
    env: cliEnvironment({ NO_COLOR: '1', FORCE_COLOR: '0' }),
    timeout: modelDiscoveryTimeout,
    killSignal: 'SIGKILL',
    maxBuffer: modelDiscoveryMaxBytes,
    signal,
    windowsHide: true,
    encoding: 'utf8',
  });
  result.child.stdin?.end();
  return stripVTControlCharacters((await result).stdout);
}

export function normalizeModels(models: readonly RuntimeModel[]): RuntimeModel[] {
  if (models.length > 5000) throw new Error('Model catalog exceeded its limit.');
  const unique = new Map<string, RuntimeModel>();
  for (const model of models) {
    if (typeof model?.value !== 'string' || typeof model?.label !== 'string')
      throw new Error('Invalid model catalog.');
    const value = model.value.trim();
    const label = stripVTControlCharacters(model.label).trim();
    if (
      !value ||
      value.length > 100 ||
      /\s/.test(value) ||
      [...value].some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      )
    )
      throw new Error('Invalid model selector.');
    if (!label || label.length > 200) throw new Error('Invalid model label.');
    if (!unique.has(value))
      unique.set(value, {
        value,
        label,
        ...(model.reasoning
          ? { reasoning: modelReasoning(model.reasoning.levels, model.reasoning.default) }
          : {}),
      });
  }
  return [...unique.values()];
}

export function suggestedModels(adapter: RuntimeAdapter, detail?: string): RuntimeModelCatalog {
  return {
    models: adapter.models,
    modelSource: adapter.id === 'demo' ? 'none' : 'fallback',
    modelDetail:
      adapter.id === 'demo'
        ? 'Demo does not use a model.'
        : (detail ?? 'Suggested models. Open settings to check the runtime.'),
  };
}

export async function discoverModels(
  adapter: RuntimeAdapter,
  available: boolean,
  signal?: AbortSignal,
): Promise<RuntimeModelCatalog> {
  if (adapter.id === 'demo') return suggestedModels(adapter);
  if (!available) return suggestedModels(adapter, 'Runtime unavailable. Showing suggested models.');
  if (!adapter.listModels)
    return suggestedModels(
      adapter,
      'Model discovery is not supported for this runtime. Showing suggestions.',
    );
  try {
    const models = normalizeModels(await adapter.listModels(signal));
    return {
      models,
      modelSource: 'runtime',
      modelDetail: models.length
        ? 'Models reported by the runtime. Access is managed by the CLI.'
        : 'The runtime reported no models. Check its native authentication and refresh.',
    };
  } catch {
    // CLI stderr and arbitrary provider metadata must never enter snapshots or the UI.
    return suggestedModels(adapter, 'Could not load models from the runtime. Showing suggestions.');
  }
}

export function parseCursorModels(text: string): RuntimeModel[] {
  const models = stripVTControlCharacters(text)
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^\s*(\S+)\s+-\s+(.+?)\s*$/);
      return match ? [{ value: match[1], label: match[2].replace(/ \(default\)$/, '') }] : [];
    });
  if (!models.length) throw new Error('Unrecognized Cursor model list.');
  return normalizeModels(models);
}

export function parseOpenCodeModels(text: string): RuntimeModel[] {
  const lines = stripVTControlCharacters(text).trim().split(/\r?\n/).filter(Boolean);
  const models: RuntimeModel[] = [];
  for (let index = 0; index < lines.length; index++) {
    const value = lines[index];
    if (!/^\S+\/\S+$/.test(value)) throw new Error('Unrecognized OpenCode model list.');
    let label = value.replace('/', ' · ');
    let reasoning: RuntimeModel['reasoning'];
    if (lines[index + 1]?.trim() === '{') {
      const start = ++index;
      while (index < lines.length && lines[index] !== '}') index++;
      const metadata = JSON.parse(lines.slice(start, index + 1).join('\n')) as {
        name?: unknown;
        variants?: unknown;
      };
      if (typeof metadata.name === 'string') label = `${value.split('/')[0]} · ${metadata.name}`;
      if (metadata.variants && typeof metadata.variants === 'object')
        reasoning = modelReasoning(Object.keys(metadata.variants));
    }
    models.push({ value, label, ...(reasoning ? { reasoning } : {}) });
  }
  return normalizeModels(models);
}

// Pi prints a whitespace-aligned table; keep both provider and model in the selector.
// https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/cli/list-models.ts
export function parsePiModels(text: string): RuntimeModel[] {
  const clean = stripVTControlCharacters(text).trim();
  if (/^No models available\b/.test(clean)) return [];
  const lines = clean.split(/\r?\n/).filter((line) => line.trim());
  const header = lines.findIndex((line) => /^provider\s+model\s+context\s+max-out\b/.test(line));
  if (header < 0) throw new Error('Unrecognized Pi model list.');
  const models = lines.slice(header + 1).map((line) => {
    const parts = line.trim().split(/\s+/);
    if (
      parts.length !== 6 ||
      !['yes', 'no'].includes(parts[4]) ||
      !['yes', 'no'].includes(parts[5])
    )
      throw new Error('Invalid Pi model row.');
    return {
      value: `${parts[0]}/${parts[1]}`,
      label: `${parts[0]} · ${parts[1]}`,
      ...(parts[4] === 'yes' ? { reasoning: piReasoning } : {}),
    };
  });
  return normalizeModels(models);
}

// Only selectors and names are retained from OMP's richer catalog response.
// https://github.com/can1357/oh-my-pi/blob/main/docs/models.md
export function parseOmpModels(text: string): RuntimeModel[] {
  const output = JSON.parse(text) as { models?: unknown };
  if (!output || !Array.isArray(output.models)) throw new Error('Invalid OMP model list.');
  return normalizeModels(
    output.models.map(
      (row: {
        selector?: unknown;
        name?: unknown;
        kind?: unknown;
        reasoning?: unknown;
        thinking?: unknown;
      }) => {
        if (!row || (row.kind !== undefined && row.kind !== 'chat'))
          throw new Error('Invalid OMP chat model.');
        if (typeof row.selector !== 'string' || typeof row.name !== 'string')
          throw new Error('Invalid OMP model row.');
        const provider = row.selector.split('/')[0];
        const reasoning = row.reasoning === true ? modelReasoning(row.thinking) : undefined;
        return {
          value: row.selector,
          label: `${provider} · ${row.name}`,
          ...(reasoning ? { reasoning } : {}),
        };
      },
    ),
  );
}

// https://kiro.dev/docs/reference/cli-commands/
export function parseKiroModels(text: string): RuntimeModel[] {
  const output = JSON.parse(text) as { models?: unknown };
  if (!output || !Array.isArray(output.models)) throw new Error('Invalid Kiro model list.');
  return normalizeModels(
    output.models.map((row: { model_id?: unknown; model_name?: unknown }) => {
      if (!row || typeof row.model_id !== 'string' || typeof row.model_name !== 'string')
        throw new Error('Invalid Kiro model row.');
      return { value: row.model_id, label: row.model_name };
    }),
  );
}

// https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/src/models.rs
export function parseGrokModels(text: string): RuntimeModel[] {
  const lines = stripVTControlCharacters(text).trim().split(/\r?\n/);
  const header = lines.findIndex((line) => line.trim() === 'Available models:');
  if (header < 0) throw new Error('Unrecognized Grok model list.');
  return normalizeModels(
    lines
      .slice(header + 1)
      .filter((line) => line.trim())
      .map((line) => {
        const match = line.match(/^\s*[-*]\s+(\S+?)(?: \(default\))?\s*$/);
        if (!match) throw new Error('Invalid Grok model row.');
        return { value: match[1], label: match[1] };
      }),
  );
}
