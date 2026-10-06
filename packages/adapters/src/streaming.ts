import type { ChatContext, RunContext } from '@pitchcrew/core';

// Decode only the reply string in the structured chat answer. Never display JSON,
// reasoning, tool arguments/results or incomplete escape sequences in the chat.
export function partialReply(raw: string): string {
  const match = raw.match(/^\s*(?:```(?:json)?\s*)?\{\s*"reply"\s*:\s*"/);
  if (!match) return '';
  let text = '';
  for (let i = match[0].length; i < raw.length; i++) {
    const char = raw[i];
    if (char === '"') break;
    if (char !== '\\') {
      if (char.charCodeAt(0) < 32) return '';
      text += char;
      continue;
    }
    const escaped = raw[++i];
    if (escaped === undefined) break;
    if (escaped === 'u') {
      const hex = raw.slice(i + 1, i + 5);
      if (hex.length < 4) break;
      if (!/^[\da-f]{4}$/i.test(hex)) return '';
      text += String.fromCharCode(parseInt(hex, 16));
      i += 4;
    } else {
      const value = { '"': '"', '\\': '\\', '/': '/', n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[
        escaped
      ];
      if (value === undefined) return '';
      text += value;
    }
  }
  // Hold a trailing high surrogate until its matching low surrogate arrives.
  return text.slice(0, 12000).replace(/[\uD800-\uDBFF]$/, '');
}

export function replyPreview(context: RunContext | ChatContext) {
  let previous = '';
  return (raw: string) => {
    if (!('messages' in context) || !context.onReply || context.signal.aborted) return;
    const text = partialReply(raw);
    if (text === previous) return;
    previous = text;
    context.onReply(text);
  };
}

function textParts(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

// Native protocol handling belongs to adapters. Final result extraction remains
// separate so a preview can never turn an incomplete/failed run into success.
export function chatEventStream(context: RunContext | ChatContext) {
  const preview = replyPreview(context);
  let raw = '';
  let itemId: unknown;
  const replace = (text: string) => {
    raw = text;
    preview(raw);
  };
  const append = (text: string) => replace(raw + text);
  return {
    replace,
    event(event: Record<string, unknown>) {
      if (!('messages' in context)) return;
      const data = event.data as Record<string, unknown> | undefined;
      const message = event.message as { role?: string; content?: unknown } | undefined;
      switch (context.role.runtime) {
        case 'claude-code': {
          if (event.parent_tool_use_id) return;
          const stream = event.event as
            | {
                type?: string;
                delta?: { type?: string; text?: string };
                content_block?: { type?: string };
              }
            | undefined;
          if (event.type === 'stream_event') {
            if (stream?.type === 'message_start') replace('');
            if (stream?.type === 'content_block_start' && stream.content_block?.type === 'tool_use')
              replace('');
            if (
              stream?.type === 'content_block_delta' &&
              stream.delta?.type === 'text_delta' &&
              typeof stream.delta.text === 'string'
            )
              append(stream.delta.text);
          }
          break;
        }
        case 'codex': {
          const item = event.item as { id?: string; type?: string; text?: string } | undefined;
          if (
            ['item.started', 'item.updated', 'item.completed'].includes(String(event.type)) &&
            item?.type === 'agent_message' &&
            typeof item.text === 'string'
          ) {
            if (item.id !== itemId) {
              itemId = item.id;
              replace('');
            }
            replace(item.text);
          }
          break;
        }
        case 'gemini-cli':
          if (event.type === 'tool_use') replace('');
          if (
            event.type === 'message' &&
            event.role === 'assistant' &&
            typeof event.content === 'string'
          ) {
            if (event.delta === true) append(event.content);
            else replace(event.content);
          }
          break;
        case 'copilot-cli':
          if (event.type === 'tool.execution_start') replace('');
          if (
            event.type === 'assistant.message_delta' &&
            data?.messageId &&
            data.messageId !== itemId
          ) {
            itemId = data.messageId;
            replace('');
          }
          if (
            event.type === 'assistant.message_delta' &&
            !data?.parentToolCallId &&
            typeof data?.deltaContent === 'string'
          )
            append(data.deltaContent);
          if (
            event.type === 'assistant.message' &&
            !data?.parentToolCallId &&
            typeof data?.content === 'string'
          )
            replace(data.content);
          break;
        case 'cursor-agent':
          if (event.type === 'tool_call' && event.subtype === 'started') replace('');
          // Buffered flushes duplicate the deltas; only timestamped non-flush events are new.
          if (
            event.type === 'assistant' &&
            typeof event.timestamp_ms === 'number' &&
            !event.model_call_id
          )
            append(textParts(message?.content));
          break;
        case 'goose':
          if (event.type === 'message' && message?.role === 'assistant') {
            if (
              Array.isArray(message.content) &&
              message.content.some((part) => part?.type === 'toolRequest')
            )
              replace('');
            else append(textParts(message.content));
          }
          break;
        case 'hermes':
          if (event.type === 'tool_use') replace('');
          if (event.type === 'text' && typeof event.text === 'string') append(event.text);
          break;
        case 'grok':
          if (event.type === 'tool_call') replace('');
          if (event.type === 'text' && typeof event.data === 'string') append(event.data);
          break;
        case 'pi':
        case 'oh-my-pi':
          if (event.type === 'message_start' || event.type === 'tool_execution_start') replace('');
          if (
            (event.type === 'message_update' || event.type === 'message_end') &&
            message?.role === 'assistant'
          )
            replace(textParts(message.content));
          break;
        case 'opencode': {
          const part = event.part as { type?: string; text?: string } | undefined;
          if (event.type === 'tool_use') replace('');
          if (event.type === 'text' && part?.type === 'text' && typeof part.text === 'string')
            replace(part.text);
          break;
        }
      }
    },
  };
}
