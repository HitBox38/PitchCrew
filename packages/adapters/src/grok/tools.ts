import { acpToolParser } from '../activity/acp-tools.ts';
import type { NativeToolParser } from '../activity/native-tools.ts';

// Tool discovery is Grok's own bookkeeping: it becomes a step only when it fails.
const parse = acpToolParser({ onlyFailures: (name) => /(?:^|:)search_tool$/.test(name) });

/**
 * Grok's streaming JSON is derived from its ACP session updates, with the update's name in
 * `type`. Its MCP calls name Pitchcrew's tools `pitchcrew__<tool>`, as the tool itself or as the
 * target of its `use_tool` helper (see activity/acp-tools.ts).
 */
export const grokTools: NativeToolParser = (scope) => {
  const tools = parse(scope);
  return (event) =>
    event.type === 'tool_call' || event.type === 'tool_call_update'
      ? tools({ ...event, sessionUpdate: event.type })
      : [];
};
