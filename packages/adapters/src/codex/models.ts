import type { RuntimeModel } from '@pitchcrew/core';
import { normalizeModels } from '../model-discovery.ts';
import { readModelCatalog } from '../process/model-catalog.ts';
import { modelReasoning } from '../reasoning.ts';

export const readCodexModels = (
  command: string,
  args: string[],
  signal?: AbortSignal,
  timeout?: number,
): Promise<RuntimeModel[]> => {
  let expectedId = 1;
  const models: RuntimeModel[] = [];
  const cursors = new Set<string>();
  const listPage = (cursor?: string) => ({
    id: ++expectedId,
    method: 'model/list',
    params: { limit: 100, includeHidden: false, ...(cursor ? { cursor } : {}) },
  });
  return readModelCatalog(command, args, {
    name: 'Codex',
    wire: 'json-lines',
    signal,
    timeout,
    initialRequest: {
      id: 1,
      method: 'initialize',
      params: { clientInfo: { name: 'pitchcrew', version: '0.1.0' } },
    },
    receive: (event: Record<string, unknown>, send) => {
      if (typeof event.method === 'string') {
        if (event.id !== undefined)
          send({
            id: event.id,
            error: { code: -32601, message: 'Unsupported client capability.' },
          });
        return;
      }
      if (event.id !== expectedId) return;
      if (event.error) throw new Error('Codex model request failed.');
      if (expectedId === 1) {
        if (!event.result || typeof event.result !== 'object')
          throw new Error('Invalid Codex initialization.');
        send({ method: 'initialized', params: {} });
        send(listPage());
        return;
      }
      const result = event.result as { data?: unknown; nextCursor?: unknown } | undefined;
      if (!result || !Array.isArray(result.data)) throw new Error('Invalid Codex model page.');
      for (const row of result.data as {
        model?: unknown;
        displayName?: unknown;
        hidden?: unknown;
        supportedReasoningEfforts?: { reasoningEffort?: unknown }[];
        defaultReasoningEffort?: unknown;
      }[]) {
        if (!row) throw new Error('Invalid Codex model row.');
        if (row.hidden === true) continue;
        if (typeof row.model !== 'string' || typeof row.displayName !== 'string')
          throw new Error('Invalid Codex model row.');
        const reasoning = modelReasoning(
          Array.isArray(row.supportedReasoningEfforts)
            ? row.supportedReasoningEfforts.map((item) => item?.reasoningEffort)
            : undefined,
          row.defaultReasoningEffort,
        );
        models.push({
          value: row.model,
          label: row.displayName,
          ...(reasoning ? { reasoning } : {}),
        });
      }
      if (models.length > 5000) throw new Error('Codex model catalog exceeded its limit.');
      if (result.nextCursor !== null && result.nextCursor !== undefined) {
        if (
          typeof result.nextCursor !== 'string' ||
          !result.nextCursor ||
          cursors.has(result.nextCursor) ||
          cursors.size >= 50
        )
          throw new Error('Invalid Codex model cursor.');
        cursors.add(result.nextCursor);
        send(listPage(result.nextCursor));
      } else return normalizeModels(models);
    },
  });
};

// https://learn.chatgpt.com/docs/app-server#list-models-modellist
// Initialize a private stdio connection, list models, then exit. No thread or turn is created.
export const codexModelArgs = [
  'app-server',
  '--listen',
  'stdio://',
  '-c',
  'features.apps=false',
  '-c',
  'features.hooks=false',
  '-c',
  'analytics.enabled=false',
];
