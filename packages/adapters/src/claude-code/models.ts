import type { RuntimeModel } from '@pitchcrew/core';
import { normalizeModels } from '../model-discovery.ts';
import { readModelCatalog } from '../process/model-catalog.ts';
import { modelReasoning } from '../reasoning.ts';

export const parseClaudeModels = (result: unknown): RuntimeModel[] => {
  const output = result as { models?: unknown } | undefined;
  if (!output || !Array.isArray(output.models)) throw new Error('Invalid Claude model catalog.');
  return normalizeModels(
    output.models.map(
      (row: {
        value?: unknown;
        displayName?: unknown;
        supportsEffort?: unknown;
        supportedEffortLevels?: unknown;
      }) => {
        if (!row || typeof row.value !== 'string' || typeof row.displayName !== 'string')
          throw new Error('Invalid Claude model row.');
        const reasoning =
          row.supportsEffort === true ? modelReasoning(row.supportedEffortLevels) : undefined;
        return { value: row.value, label: row.displayName, ...(reasoning ? { reasoning } : {}) };
      },
    ),
  );
};

export const readClaudeModels = (
  command: string,
  args: string[],
  signal?: AbortSignal,
  timeout?: number,
): Promise<RuntimeModel[]> => {
  const requestId = 'pitchcrew-models';
  return readModelCatalog(command, args, {
    name: 'Claude',
    wire: 'json-lines',
    countStderr: true,
    signal,
    timeout,
    initialRequest: {
      type: 'control_request',
      request_id: requestId,
      request: { subtype: 'initialize' },
    },
    receive: (
      event: {
        type?: unknown;
        request_id?: unknown;
        response?: { subtype?: unknown; request_id?: unknown; response?: unknown };
      } | null,
      send,
    ) => {
      if (!event) return;
      if (event.type === 'control_request') {
        if (typeof event.request_id !== 'string')
          throw new Error('Invalid Claude control request.');
        send({
          type: 'control_response',
          response: {
            subtype: 'error',
            request_id: event.request_id,
            error: 'Model discovery does not support this request.',
          },
        });
        return;
      }
      if (event.type !== 'control_response' || event.response?.request_id !== requestId) return;
      if (event.response.subtype !== 'success') throw new Error('Claude model request failed.');
      return parseClaudeModels(event.response.response);
    },
  });
};

// SDK initialization reports the native model catalog without a user message or inference.
// https://github.com/anthropics/claude-agent-sdk-python/blob/main/src/claude_agent_sdk/_internal/query.py
export const claudeModelArgs = [
  '-p',
  '--input-format',
  'stream-json',
  '--output-format',
  'stream-json',
  '--verbose',
  '--safe-mode',
  '--restricted',
  '--tools',
  '',
  '--strict-mcp-config',
  '--mcp-config',
  '{"mcpServers":{}}',
  '--no-session-persistence',
  '--setting-sources',
  '',
  '--settings',
  '{"disableAllHooks":true}',
];
