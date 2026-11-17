import type { ActivityToolKind, ToolFailureReason } from '@pitchcrew/core';
import {
  asRecord,
  asString,
  commandLine,
  contentText,
  displayPath,
  type NativeToolEvent,
  type NativeToolFinish,
  type NativeToolParser,
  type NativeToolStart,
} from '../activity/native-tools.ts';

type Args = Record<string, unknown>;
type Call = Pick<NativeToolStart, 'kind' | 'detail' | 'pitchcrew'>;
type Describe = (args: Args, cwd: string) => string | undefined;

const command: Describe = (args) => {
  const value = asString(args.command);
  return value && commandLine(value);
};
const filePath: Describe = (args, cwd) => {
  const value = asString(args.path);
  return value && displayPath(value, cwd);
};

/** Goose's platform tools. Pitchcrew's recipe loads none of them, but a call to one still shows. */
const builtIns: Record<string, [ActivityToolKind, Describe?]> = {
  shell: ['command', command],
  write: ['edit', filePath],
  edit: ['edit', filePath],
  tree: ['read', filePath],
  read_image: ['read', filePath],
};

/**
 * Extension tools are named `<extension>__<tool>`; the recipe names Pitchcrew's extension
 * `pitchcrew`, so its connector tools (github_…, gmail_…) match too.
 */
const describe = (name: string, args: Args, cwd: string): Call => {
  const at = name.indexOf('__');
  if (at > 0) {
    const extension = name.slice(0, at);
    const tool = name.slice(at + 2);
    if (extension === 'pitchcrew') return { kind: 'mcp', pitchcrew: tool };
    // Another extension's tool shows its names only, never its arguments.
    return extension === 'todo'
      ? { kind: 'todo' }
      : { kind: 'mcp', detail: `${tool} (${extension})` };
  }
  if (!Object.hasOwn(builtIns, name)) return { kind: 'other' };
  const [kind, detail] = builtIns[name];
  return { kind, detail: detail?.(args, cwd) };
};

/** rmcp error codes for a call Goose could not run. */
const errorCodes: Record<string, ToolFailureReason> = {
  '-32002': 'not_found',
  '-32602': 'invalid_input',
};

/** Goose's error text is rmcp's `<code>: <message>`; a missing tool's also lists every tool. */
const callError = (value: unknown): Pick<NativeToolFinish, 'reason' | 'failure'> => {
  const error = asString(value) ?? '';
  const code = /^(-?\d+):/.exec(error)?.[1];
  return {
    reason: asString(error.replace(/^-?\d+:\s*/, '').replace(/\s*Available tools:[\s\S]*$/, '')),
    failure: code && Object.hasOwn(errorCodes, code) ? errorCodes[code] : undefined,
  };
};

const request = (callId: string, toolCall: Args, cwd: string): NativeToolEvent[] => {
  const value = asRecord(toolCall.value);
  const name = asString(value?.name);
  if (toolCall.status !== 'success' || !name) return [];
  return [{ phase: 'start', callId, ...describe(name, asRecord(value?.arguments) ?? {}, cwd) }];
};

/**
 * The model's call could not be parsed, so it never ran. Goose's text quotes the model's raw
 * arguments ("Raw arguments: '…'", or the tail of malformed JSON), so only the fixed reason shows.
 */
const unparsedCall = (callId: string): NativeToolEvent[] => [
  { phase: 'start', callId, kind: 'other' },
  { phase: 'finish', callId, failed: true, failure: 'invalid_input' },
];

const response = (callId: string, toolResult: Args): NativeToolEvent[] => {
  // Goose itself could not run the call (unknown tool, timeout, transport): no server answered.
  if (toolResult.status === 'error')
    return [
      { phase: 'finish', callId, failed: true, ...callError(toolResult.error), preGateway: true },
    ];
  if (toolResult.status !== 'success') return [];
  const value = asRecord(toolResult.value);
  return value?.isError === true
    ? [{ phase: 'finish', callId, failed: true, reason: asString(contentText(value.content)) }]
    : [{ phase: 'finish', callId, failed: false }];
};

/**
 * Goose's stream-json messages: assistant `toolRequest` parts start calls and user-role
 * `toolResponse` parts finish them, linked by id.
 */
export const gooseTools: NativeToolParser = ({ cwd }) => {
  // A call Goose could not parse ends at once, and its answer, which repeats the model's raw
  // arguments, is dropped. Bounded: a long turn keeps only recent ones.
  const unparsed = new Set<string>();
  return (event) => {
    const content = asRecord(event.message)?.content;
    if (event.type !== 'message' || !Array.isArray(content)) return [];
    return content.flatMap((value): NativeToolEvent[] => {
      const part = asRecord(value);
      const callId = asString(part?.id);
      if (!part || !callId) return [];
      if (part.type === 'toolRequest') {
        const toolCall = asRecord(part.toolCall) ?? {};
        if (toolCall.status !== 'error') return request(callId, toolCall, cwd);
        unparsed.add(callId);
        if (unparsed.size > 256) unparsed.delete(unparsed.values().next().value!);
        return unparsedCall(callId);
      }
      if (part.type !== 'toolResponse' || unparsed.delete(callId)) return [];
      return response(callId, asRecord(part.toolResult) ?? {});
    });
  };
};
