import {
  activityLimits,
  activityLine,
  mcpConnectorTools,
  states,
  type ChatMessage,
  type Role,
  type Run,
} from '@pitchcrew/core';
import { canReadConversation } from '../conversations.ts';
import { findEntity } from '../queue/queries.ts';
import type { CrewContext, RunCapability } from '../types.ts';

interface Call {
  context: CrewContext;
  capability: RunCapability;
  run: Run;
  data: Record<string, unknown>;
  /** MCP tools wrap most arguments in `input`; a few send them flat. */
  input: Record<string, unknown>;
}

const services = [
  ['github_', 'GitHub'],
  ['gmail_', 'Gmail'],
  ['google_drive_', 'Google Drive'],
  ['google_docs_', 'Google Docs'],
  ['google_sheets_', 'Google Sheets'],
  ['google_calendar_', 'Google Calendar'],
] as const;

/** "gmail_search_messages" → "Gmail · search messages", for reviewed connector tools only. */
const connectorTool = (tool: unknown) => {
  if (typeof tool !== 'string' || !mcpConnectorTools.includes(tool)) return undefined;
  const service = services.find(([prefix]) => tool.startsWith(prefix));
  return service && `${service[1]} · ${tool.slice(service[0].length).replaceAll('_', ' ')}`;
};

const roleName = (context: CrewContext, id: unknown) =>
  typeof id === 'string' ? findEntity<Role>(context, 'role', id)?.name : undefined;

const host = (url: unknown) => {
  try {
    return typeof url === 'string' ? new URL(url).hostname || undefined : undefined;
  } catch {
    return undefined;
  }
};

/** Named only when the run may read the message that carries the file. */
const attachmentName = ({ context, capability, data }: Call) => {
  const message =
    typeof data.messageId === 'string'
      ? findEntity<ChatMessage>(context, 'message', data.messageId)
      : undefined;
  if (!message || !canReadConversation(context, capability.roleId, message.threadId))
    return undefined;
  return message.attachments?.find((file) => file.id === data.attachmentId)?.name;
};

const text = (...values: unknown[]) =>
  values
    .filter((value): value is string => typeof value === 'string' && !!value.trim())
    .join(' · ');

/** A board state in words: "in_review" → "in review". */
const stateWords = (state: unknown) =>
  typeof state === 'string' && (states as readonly string[]).includes(state)
    ? state.replaceAll('_', ' ')
    : undefined;

const count = (items: unknown, noun: string) =>
  Array.isArray(items) && items.length
    ? `${items.length} ${noun}${items.length === 1 ? '' : 's'}`
    : undefined;

/**
 * What each crew tool works on, in one public line: a connected service, a skill, a crew member,
 * a site, a file name, a short query, a target state or a count. Only these values, never message,
 * memory, profile or packet text, and nothing for browser tools: their labels already name the
 * element, without values.
 */
const details: Readonly<Record<string, (call: Call) => string | undefined>> = {
  connector: ({ data }) => connectorTool(data.tool),
  read_skill: ({ run, input }) =>
    run.configuration?.skills.find((skill) => skill.id === input.skillId)?.name,
  message: ({ context, data }) => roleName(context, data.roleId),
  invoke: ({ context, data }) => roleName(context, data.roleId),
  import_job_link: ({ input }) => host(input.url),
  chat_attachment: attachmentName,
  recall_memory: ({ input }) => text(input.query),
  applications: ({ input }) => text(input.company, input.title),
  workflow: ({ data }) => stateWords(data.state),
  delegate_round: ({ input }) => count(input.delegates, 'subtask'),
};

/** One bounded line of public detail for a crew tool step, or nothing. Never throws. */
export const crewToolDetail = (
  context: CrewContext,
  capability: RunCapability,
  run: Run,
  action: string,
  data: Record<string, unknown> = {},
) => {
  try {
    if (!Object.hasOwn(details, action)) return undefined;
    const input =
      data.input && typeof data.input === 'object' ? (data.input as Record<string, unknown>) : data;
    return activityLine(
      details[action]!({ context, capability, run, data, input }),
      activityLimits.detail,
    );
  } catch {
    return undefined;
  }
};
