import {
  asRecord,
  asString,
  commandLine,
  contentText,
  displayPath,
  exitReason,
  planProgress,
  type NativeToolEvent,
  type NativeToolFinish,
  type NativeToolParser,
  type NativeToolStart,
} from '../activity/native-tools.ts';

type Item = Record<string, unknown>;
type Call = Omit<NativeToolStart, 'phase' | 'callId'>;
type Outcome = Omit<NativeToolFinish, 'phase' | 'callId'>;

/** Codex's sub-agent tools, the only collab text a step may show. */
const collabTools = new Set(['spawn_agent', 'send_input', 'wait', 'close_agent']);

const changedFiles = (changes: unknown, cwd: string) => {
  const paths = Array.isArray(changes)
    ? changes.flatMap((change) => asString(asRecord(change)?.path) ?? [])
    : [];
  if (!paths.length) return undefined;
  const first = displayPath(paths[0], cwd);
  return paths.length > 1 ? `${first} +${paths.length - 1} more` : first;
};

/** A tool item's kind and target; undefined for messages, reasoning and warnings. */
const describe = (item: Item, cwd: string): Call | undefined => {
  switch (item.type) {
    case 'command_execution': {
      const command = asString(item.command);
      return { kind: 'command', detail: command && commandLine(command) };
    }
    case 'file_change':
      return { kind: 'edit', detail: changedFiles(item.changes, cwd) };
    case 'mcp_tool_call': {
      const server = asString(item.server);
      const tool = asString(item.tool);
      if (!server || !tool) return undefined;
      // Pitchcrew's arguments stay private: its calls carry only the tool name.
      return server === 'pitchcrew'
        ? { kind: 'mcp', pitchcrew: tool }
        : { kind: 'mcp', detail: `${tool} (${server})` };
    }
    case 'web_search':
      return { kind: 'web_search', detail: asString(item.query) };
    case 'collab_tool_call': {
      // The prompt is the whole instruction sent to the other agent: only the tool's name shows.
      const tool = asString(item.tool);
      return { kind: 'agent', detail: tool && collabTools.has(tool) ? tool : undefined };
    }
    case 'todo_list':
      return { kind: 'todo', detail: planProgress(item.items, (step) => step.completed === true) };
  }
  return undefined;
};

const commandOutcome = (item: Item): Outcome => {
  const code = typeof item.exit_code === 'number' ? item.exit_code : undefined;
  const output = asString(item.aggregated_output);
  if (code !== undefined && code !== 0)
    return { failed: true, reason: exitReason(code, output), failure: 'tool_error' };
  return item.status === 'failed' ? { failed: true, reason: output } : { failed: false };
};

const mcpOutcome = (item: Item): Outcome => {
  if (item.status !== 'failed') return { failed: false };
  // No answer came back (timeout, transport): Pitchcrew's daemon never answered the call. Its
  // answers, refusals included, arrive as a result.
  const error = asString(asRecord(item.error)?.message);
  if (error) return { failed: true, reason: error, preGateway: true };
  return { failed: true, reason: contentText(asRecord(item.result)?.content) };
};

const collabOutcome = (item: Item): Outcome => {
  if (item.status !== 'failed') return { failed: false };
  const states = Object.values(asRecord(item.agents_states) ?? {}).map(asRecord);
  return {
    failed: true,
    reason: asString(states.find((state) => state?.status === 'errored')?.message),
  };
};

/** How a completed item ended. */
const outcome = (item: Item): Outcome => {
  // A call still running when the turn ended is completed as it was.
  if (item.status === 'in_progress') return { failed: false, interrupted: true };
  if (item.status === 'declined')
    return {
      failed: true,
      reason: 'Declined by the sandbox or approval policy.',
      failure: 'not_allowed',
    };
  switch (item.type) {
    case 'command_execution':
      return commandOutcome(item);
    case 'file_change':
      return item.status === 'failed'
        ? { failed: true, reason: 'The patch was not applied.' }
        : { failed: false };
    case 'mcp_tool_call':
      return mcpOutcome(item);
    case 'collab_tool_call':
      return collabOutcome(item);
  }
  return { failed: false };
};

/**
 * Codex's `exec --json` items: `item.started` starts a call and `item.completed` finishes it,
 * describing the call again so items reported only once completed still show.
 */
export const codexTools: NativeToolParser =
  ({ cwd }) =>
  (event): NativeToolEvent[] => {
    const item = asRecord(event.item);
    const callId = asString(item?.id);
    const call = item && callId ? describe(item, cwd) : undefined;
    if (!item || !callId || !call) return [];
    // A plan has no running phase: each version of it, from the first to the turn's last, is a
    // finished update of one step that shows its progress.
    if (call.kind === 'todo')
      return ['item.started', 'item.updated', 'item.completed'].includes(String(event.type))
        ? [{ phase: 'finish', callId, failed: false, ...call }]
        : [];
    // A search starts before its query is known; it then shows once it completes.
    if (event.type === 'item.started')
      return call.kind === 'web_search' && !call.detail
        ? []
        : [{ phase: 'start', callId, ...call }];
    if (event.type === 'item.completed')
      return [{ phase: 'finish', callId, ...call, ...outcome(item) }];
    return [];
  };
