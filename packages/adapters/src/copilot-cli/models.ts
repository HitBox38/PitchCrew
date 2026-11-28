import type { RuntimeModel } from '@pitchcrew/core';
import { normalizeModels } from '../model-discovery.ts';
import { readModelCatalog } from '../process/model-catalog.ts';
import { modelReasoning } from '../reasoning.ts';

const parseCopilotModels = (result: unknown): RuntimeModel[] => {
  const output = result as { models?: unknown } | undefined;
  if (!output || !Array.isArray(output.models)) throw new Error('Invalid Copilot model catalog.');
  return normalizeModels(
    output.models.flatMap(
      (row: {
        id?: unknown;
        name?: unknown;
        policy?: { state?: unknown };
        capabilities?: { supports?: { reasoningEffort?: unknown } };
        supportedReasoningEfforts?: unknown;
        defaultReasoningEffort?: unknown;
      }) => {
        if (!row || typeof row.id !== 'string' || typeof row.name !== 'string')
          throw new Error('Invalid Copilot model row.');
        if (row.policy?.state === 'disabled') return [];
        const reasoning =
          row.capabilities?.supports?.reasoningEffort === true
            ? modelReasoning(row.supportedReasoningEfforts, row.defaultReasoningEffort)
            : undefined;
        return [{ value: row.id, label: row.name, ...(reasoning ? { reasoning } : {}) }];
      },
    ),
  );
};

export const readCopilotModels = (
  command: string,
  args: string[],
  signal?: AbortSignal,
  timeout?: number,
): Promise<RuntimeModel[]> => {
  let expectedId = 1;
  let stage: 'connect' | 'ping' | 'models' = 'connect';
  return readModelCatalog(command, args, {
    name: 'Copilot',
    wire: 'framed-json-rpc',
    signal,
    timeout,
    initialRequest: { id: 1, method: 'connect', params: {} },
    receive: (
      event: {
        jsonrpc?: unknown;
        id?: unknown;
        method?: unknown;
        error?: { code?: unknown };
        result?: unknown;
      },
      send,
    ) => {
      if (!event || event.jsonrpc !== '2.0') throw new Error('Invalid Copilot model response.');
      if (typeof event.method === 'string') {
        if (event.id !== undefined)
          send({
            id: event.id,
            error: { code: -32601, message: 'Unsupported client capability.' },
          });
        return;
      }
      if (event.id !== expectedId) return;
      if (event.error) {
        if (stage === 'connect' && event.error.code === -32601) {
          stage = 'ping';
          send({ id: ++expectedId, method: 'ping', params: {} });
          return;
        }
        throw new Error('Copilot model request failed.');
      }
      if (stage !== 'models') {
        const result = event.result as { protocolVersion?: unknown } | undefined;
        if (!result || typeof result.protocolVersion !== 'number' || result.protocolVersion < 3)
          throw new Error('Unsupported Copilot model protocol.');
        stage = 'models';
        send({ id: ++expectedId, method: 'models.list', params: {} });
      } else return parseCopilotModels(event.result);
    },
  });
};

// Native Copilot SDK transport: Content-Length framed JSON-RPC, with no session.create/send.
// https://github.com/github/copilot-sdk/blob/main/nodejs/src/client.ts
export const copilotModelArgs = ['--headless', '--stdio', '--no-auto-update'];
