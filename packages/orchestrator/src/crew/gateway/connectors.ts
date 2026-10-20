import type { AgentCapabilities } from '@pitchcrew/core';
import { connectorTools, getConnectorTool } from '@pitchcrew/mcp/connectors';
import { z } from 'zod';
import type { CrewContext, RunCapability } from '../types.ts';

export const connectorAccess = async (
  context: CrewContext,
  permissions: AgentCapabilities,
): Promise<Record<string, unknown>> => {
  const tools = Object.entries(connectorTools)
    .filter(([, tool]) => permissions[tool.permission] === true)
    .map(([name]) => name);
  const providers = new Set(tools.map((name) => getConnectorTool(name).provider));
  return { tools, connectors: context.connectors.status().filter((c) => providers.has(c.id)) };
};
export const connectorAction = async (
  context: CrewContext,
  capability: RunCapability,
  permissions: AgentCapabilities,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const input = z.object({ tool: z.string().max(100), input: z.unknown() }).parse(data);
  const tool = getConnectorTool(input.tool);
  if (permissions[tool.permission] !== true)
    throw new Error('This connector capability is disabled for your role. Enable it in Your crew.');
  const signal = context.controllers.get(capability.runId)?.signal;
  if (!signal) throw new Error('Connector calls require an active run.');
  return context.connectors.call(input.tool, input.input, signal);
};
