import type {
  ChatContext,
  RunContext,
  RuntimeAdapter,
  RuntimeHealth,
  RuntimeId,
} from '@pitchcrew/core';
import { chatResultSchema } from '@pitchcrew/core';
import { chatPromptFor, promptFor } from './prompts.ts';
import { cleanResult, parseWorkflowResult } from './results.ts';

export const withChat = (adapter: {
  applicationIsolation?: true;
  reviewSubagents?: { maxConcurrent: number };
  id: RuntimeId;
  models: RuntimeAdapter['models'];
  listModels?: RuntimeAdapter['listModels'];
  detect(): Promise<RuntimeHealth>;
  launch(context: RunContext | ChatContext, prompt: string): Promise<string>;
}): RuntimeAdapter => {
  return {
    applicationIsolation: adapter.applicationIsolation,
    reviewSubagents: adapter.reviewSubagents,
    id: adapter.id,
    models: adapter.models,
    listModels: adapter.listModels,
    detect: () => adapter.detect(),
    run: async (context) =>
      parseWorkflowResult(await adapter.launch(context, promptFor(context)), context),
    chat: async (context) =>
      chatResultSchema.parse(
        JSON.parse(cleanResult(await adapter.launch(context, chatPromptFor(context)))),
      ),
  };
};
