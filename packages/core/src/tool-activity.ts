import stripAnsi from 'strip-ansi';
import { mcpConnectorTools, mcpGatewayTools } from './telemetry-mcp.ts';
import type { ToolFailureReason } from './tool-failures.ts';

/**
 * Tool steps in a turn's activity: what kind of work each step is, its words in three tenses and
 * the public text a step may carry. Plain values only (no zod), shared by adapters, daemon and
 * renderer.
 */
export const activityToolKinds = Object.freeze([
  'command',
  'read',
  'edit',
  'search',
  'fetch',
  'web_search',
  'mcp',
  'agent',
  'todo',
  'browser',
  'ask',
  'check',
  'other',
] as const);
export type ActivityToolKind = (typeof activityToolKinds)[number];
const kinds = new Set<string>(activityToolKinds);
export const isActivityToolKind = (value: unknown): value is ActivityToolKind =>
  typeof value === 'string' && kinds.has(value);

/** Bounds shared by everything that records, checkpoints or renders activity. */
export const activityLimits = Object.freeze({
  id: 160,
  label: 160,
  /** One line: a command, path, query, host or named target. */
  detail: 200,
  /** Why a step failed. */
  error: 300,
  text: 4000,
  entries: 80,
});

/** Steps for a runtime's own tool calls share one id prefix, apart from the gateway's `tool-…`. */
const runtimeStepPrefix = 'native-';
export const runtimeStepId = (callId: string) =>
  `${runtimeStepPrefix}${callId.replace(/\s+/g, '_')}`.slice(0, activityLimits.id);
/** A step a runtime's own tool call produced, rather than a Pitchcrew gateway call. */
export const isRuntimeStep = (entry: { id: string }) => entry.id.startsWith(runtimeStepPrefix);

export interface ToolLabels {
  running: string;
  done: string;
  failed: string;
}
export interface CrewToolLabels extends ToolLabels {
  tool: ActivityToolKind;
}

/** A step's label for its status: running and interrupted keep the running words. */
export const toolLabel = (labels: ToolLabels, status: string) =>
  status === 'failed' ? labels.failed : status === 'completed' ? labels.done : labels.running;

/** Native runtime tools (shell, files, web), named by kind; the detail names the target. */
export const nativeToolLabels: Readonly<Record<ActivityToolKind, ToolLabels>> = Object.freeze({
  command: { running: 'Running command', done: 'Ran command', failed: 'Command failed' },
  read: { running: 'Reading file', done: 'Read file', failed: "Couldn't read file" },
  edit: { running: 'Editing file', done: 'Edited file', failed: "Couldn't edit file" },
  search: { running: 'Searching files', done: 'Searched files', failed: 'Search failed' },
  fetch: { running: 'Fetching page', done: 'Fetched page', failed: "Couldn't fetch page" },
  web_search: {
    running: 'Searching the web',
    done: 'Searched the web',
    failed: 'Web search failed',
  },
  mcp: { running: 'Calling tool', done: 'Called tool', failed: 'Tool call failed' },
  agent: { running: 'Running subagent', done: 'Ran subagent', failed: 'Subagent failed' },
  todo: { running: 'Updating plan', done: 'Updated plan', failed: "Couldn't update plan" },
  browser: {
    running: 'Using the browser',
    done: 'Used the browser',
    failed: "Couldn't use the browser",
  },
  ask: { running: 'Asking you', done: 'Asked you', failed: "Couldn't ask you" },
  check: { running: 'Checking', done: 'Checked', failed: 'Check failed' },
  other: { running: 'Using tool', done: 'Used tool', failed: 'Tool failed' },
});

const crew = (
  tool: ActivityToolKind,
  running: string,
  done: string,
  failed: string,
): CrewToolLabels => ({ tool, running, done, failed });

/**
 * Pitchcrew's scoped tools by gateway action, verb first in each tense. Browser actions get
 * their exact words from the browser step labels; these cover only a call that never reached
 * the daemon.
 */
export const crewToolLabels: Readonly<Record<string, CrewToolLabels>> = Object.freeze({
  quality: crew(
    'edit',
    'Updating writing preferences and career plans',
    'Updated writing preferences and career plans',
    "Couldn't update writing preferences and career plans",
  ),
  check_linkedin_draft: crew(
    'check',
    'Checking LinkedIn draft lengths',
    'Checked LinkedIn draft lengths',
    "Couldn't check LinkedIn draft lengths",
  ),
  start_deep_review: crew(
    'agent',
    'Starting deep resume review',
    'Started deep resume review',
    "Couldn't start deep resume review",
  ),
  start_review_subagent: crew(
    'agent',
    'Starting targeted second opinion',
    'Started targeted second opinion',
    "Couldn't start targeted second opinion",
  ),
  review_subagents: crew(
    'read',
    'Reading second opinions',
    'Read second opinions',
    "Couldn't read second opinions",
  ),
  extend_review_deadline: crew(
    'other',
    'Extending shared review deadline',
    'Extended shared review deadline',
    "Couldn't extend shared review deadline",
  ),
  request_review_time: crew(
    'ask',
    'Requesting more review time',
    'Requested more review time',
    "Couldn't request more review time",
  ),
  profile: crew('read', 'Reading profile', 'Read profile', "Couldn't read profile"),
  profile_edit_sources: crew(
    'read',
    'Reading profile edit sources',
    'Read profile edit sources',
    "Couldn't read profile edit sources",
  ),
  update_profile: crew(
    'edit',
    'Updating profile and its GitHub source',
    'Updated profile and its GitHub source',
    "Couldn't update profile and its GitHub source",
  ),
  watched_profile_sources: crew(
    'read',
    'Reading watched profile sources',
    'Read watched profile sources',
    "Couldn't read watched profile sources",
  ),
  detect_profile_changes: crew(
    'check',
    'Checking profile sources for changes',
    'Checked profile sources for changes',
    "Couldn't check profile sources for changes",
  ),
  read_project_watch_file: crew(
    'read',
    'Reading a watched project file',
    'Read a watched project file',
    "Couldn't read a watched project file",
  ),
  propose_profile_note: crew(
    'ask',
    'Proposing a profile note',
    'Proposed a profile note',
    "Couldn't propose a profile note",
  ),
  card: crew('read', 'Reading job details', 'Read job details', "Couldn't read job details"),
  jobs: crew('read', 'Listing jobs', 'Listed jobs', "Couldn't list jobs"),
  update_job: crew(
    'edit',
    'Correcting saved job details',
    'Corrected saved job details',
    "Couldn't correct saved job details",
  ),
  delete_job: crew('edit', 'Deleting a job', 'Deleted a job', "Couldn't delete a job"),
  bulk_move_jobs: crew('edit', 'Moving jobs', 'Moved jobs', "Couldn't move jobs"),
  bulk_delete_jobs: crew('edit', 'Deleting jobs', 'Deleted jobs', "Couldn't delete jobs"),
  history: crew(
    'read',
    'Reading application history',
    'Read application history',
    "Couldn't read application history",
  ),
  messages: crew(
    'read',
    'Reading conversations',
    'Read conversations',
    "Couldn't read conversations",
  ),
  conversations: crew(
    'read',
    'Listing conversations',
    'Listed conversations',
    "Couldn't list conversations",
  ),
  conversation_messages: crew(
    'read',
    'Reading conversation',
    'Read conversation',
    "Couldn't read conversation",
  ),
  create_group: crew(
    'agent',
    'Creating a group chat',
    'Created a group chat',
    "Couldn't create a group chat",
  ),
  invite_agent: crew(
    'agent',
    'Inviting a crew member',
    'Invited a crew member',
    "Couldn't invite a crew member",
  ),
  transfer_lead: crew(
    'agent',
    'Handing over the lead',
    'Handed over the lead',
    "Couldn't hand over the lead",
  ),
  roles: crew('read', 'Checking crew', 'Checked crew', "Couldn't check crew"),
  chat_attachment: crew(
    'read',
    'Reading attachment',
    'Read attachment',
    "Couldn't read attachment",
  ),
  recall_memory: crew(
    'search',
    'Recalling saved context',
    'Recalled saved context',
    "Couldn't recall saved context",
  ),
  save_memory: crew('edit', 'Saving a memory', 'Saved a memory', "Couldn't save a memory"),
  read_skill: crew(
    'read',
    'Reading skill instructions',
    'Read skill instructions',
    "Couldn't read skill instructions",
  ),
  scan_job_sources: crew(
    'fetch',
    'Scanning saved job boards',
    'Scanned saved job boards',
    "Couldn't scan saved job boards",
  ),
  import_job_link: crew(
    'fetch',
    'Reading job link and saving job details',
    'Read job link and saved job details',
    "Couldn't read job link",
  ),
  job_sources: crew('read', 'Reading job sources', 'Read job sources', "Couldn't read job sources"),
  connector: crew(
    'mcp',
    'Reading connected sources',
    'Read connected sources',
    "Couldn't read connected sources",
  ),
  lint: crew('check', 'Checking packet', 'Checked packet', "Couldn't check packet"),
  packet_rules: crew(
    'read',
    'Reading packet rules',
    'Read packet rules',
    "Couldn't read packet rules",
  ),
  export: crew(
    'edit',
    'Exporting approved packet',
    'Exported approved packet',
    "Couldn't export approved packet",
  ),
  workflow: crew(
    'edit',
    'Updating application workflow',
    'Updated application workflow',
    "Couldn't update application workflow",
  ),
  message: crew(
    'agent',
    'Messaging a crew member',
    'Messaged a crew member',
    "Couldn't message a crew member",
  ),
  invoke: crew(
    'agent',
    'Requesting crew work',
    'Requested crew work',
    "Couldn't request crew work",
  ),
  delegate_round: crew(
    'agent',
    'Delegating subtasks to the crew',
    'Delegated subtasks to the crew',
    "Couldn't delegate subtasks to the crew",
  ),
  ask_user: crew(
    'ask',
    'Asking you a question',
    'Asked you a question',
    "Couldn't ask you a question",
  ),
  notify_user: crew('ask', 'Posting an update', 'Posted an update', "Couldn't post an update"),
  report_progress: crew('ask', 'Posting progress', 'Posted progress', "Couldn't post progress"),
  report_technical_problem: crew(
    'other',
    'Reporting a technical problem',
    'Reported a technical problem',
    "Couldn't report a technical problem",
  ),
  propose: crew(
    'ask',
    'Proposing agent changes',
    'Proposed agent changes',
    "Couldn't propose agent changes",
  ),
  propose_crew_changes: crew(
    'ask',
    'Proposing crew changes',
    'Proposed crew changes',
    "Couldn't propose crew changes",
  ),
  propose_skill: crew('ask', 'Suggesting a skill', 'Suggested a skill', "Couldn't suggest a skill"),
  read_pipeline: crew(
    'read',
    'Reviewing applications',
    'Reviewed applications',
    "Couldn't review applications",
  ),
  save_pipeline_review: crew(
    'edit',
    'Saving pipeline review',
    'Saved pipeline review',
    "Couldn't save pipeline review",
  ),
  update_pipeline_review: crew(
    'edit',
    'Updating pipeline review',
    'Updated pipeline review',
    "Couldn't update pipeline review",
  ),
  applications: crew(
    'search',
    'Reading applications',
    'Read applications',
    "Couldn't read applications",
  ),
  submission_attempts: crew(
    'read',
    'Reading submission attempts',
    'Read submission attempts',
    "Couldn't read submission attempts",
  ),
  application_insights: crew(
    'read',
    'Reading application insights',
    'Read application insights',
    "Couldn't read application insights",
  ),
  tracking_scan: crew(
    'search',
    'Checking tracked applications',
    'Checked tracked applications',
    "Couldn't check tracked applications",
  ),
  tracking_reconcile: crew(
    'edit',
    'Updating tracked applications',
    'Updated tracked applications',
    "Couldn't update tracked applications",
  ),
  routines: crew('read', 'Reading routines', 'Read routines', "Couldn't read routines"),
  save_routine: crew('edit', 'Saving a routine', 'Saved a routine', "Couldn't save a routine"),
  delete_routine: crew(
    'edit',
    'Deleting a routine',
    'Deleted a routine',
    "Couldn't delete a routine",
  ),
  computer_inspect: crew(
    'browser',
    'Using the browser',
    'Used the browser',
    "Couldn't use the browser",
  ),
  computer_wait: crew(
    'browser',
    'Using the browser',
    'Used the browser',
    "Couldn't use the browser",
  ),
  computer_tabs: crew(
    'browser',
    'Using the browser',
    'Used the browser',
    "Couldn't use the browser",
  ),
  computer_request: crew(
    'browser',
    'Using the browser',
    'Used the browser',
    "Couldn't use the browser",
  ),
  computer_execute: crew(
    'browser',
    'Using the browser',
    'Used the browser',
    "Couldn't use the browser",
  ),
  assess_form: crew('browser', 'Using the browser', 'Used the browser', "Couldn't use the browser"),
  capture_submission: crew(
    'browser',
    'Using the browser',
    'Used the browser',
    "Couldn't use the browser",
  ),
});

/** An action the gateway does not name yet; its arguments never become its words. */
export const unknownCrewToolLabels: CrewToolLabels = crew(
  'other',
  'Using a crew tool',
  'Used a crew tool',
  "Couldn't use a crew tool",
);

export const crewToolLabelsFor = (action: string): CrewToolLabels =>
  Object.hasOwn(crewToolLabels, action) ? crewToolLabels[action]! : unknownCrewToolLabels;

const actionsByTool = new Map<string, string>(
  Object.entries(mcpGatewayTools).map(([action, name]) => [name, action]),
);
const connectorNames = new Set<string>(mcpConnectorTools);

/**
 * The gateway action behind a reviewed MCP tool name ("pitchcrew_get_card" → "card"), or
 * "connector" for connected-account tools. Undefined for anything Pitchcrew does not publish.
 */
export const crewActionForTool = (name: string): string | undefined =>
  actionsByTool.get(name) ?? (connectorNames.has(name) ? 'connector' : undefined);

/**
 * A Pitchcrew tool call the daemon never received: the MCP server rejected its arguments or
 * name, or the runtime gave up on it (its own validation, timeout or transport). The gateway
 * records every call it does receive, with its own reason.
 */
export const preGatewayFailure = (text: string) =>
  /^\s*(?:<tool_use_error>\s*)?(?:error:\s*)?(?:MCP error -?\d+:|McpError\b|InputValidationError\b|No such tool available|Tool ['"`]?[\w.-]+['"`]? not found|Input validation error)/i.test(
    text,
  );

/** A closed reason for a native tool failure, from the runtime's own failure text. */
export const nativeFailureReason = (text: string): ToolFailureReason => {
  if (
    /input validation|invalid arguments|invalid_type|invalid param|schema validation|(?:not|n't|failed to) match (?:the |its )?(?:input |tool )?schema/i.test(
      text,
    )
  )
    return 'invalid_input';
  if (/timed?[ -]?out|timeout|deadline exceeded/i.test(text)) return 'timeout';
  if (
    /permission|denied|not allowed|disallowed|disabled|policy|forbidden|requires (?:user )?(?:confirmation|approval)|blocked/i.test(
      text,
    )
  )
    return 'not_allowed';
  if (/no such tool|unknown tool|unavailable tool|not registered|tool [^\s]+ not found/i.test(text))
    return 'not_found';
  if (
    /ECONN\w*|ENOTFOUND|EAI_AGAIN|network|connection (?:closed|reset|refused)|transport|disconnected|not connected|unreachable|unavailable/i.test(
      text,
    )
  )
    return 'unavailable';
  if (/cancel(?:l)?ed|interrupted|aborted/i.test(text)) return 'cancelled';
  if (/no such file|not found|does not exist|ENOENT/i.test(text)) return 'not_found';
  return 'tool_error';
};

// eslint-disable-next-line no-control-regex -- Activity text is one printable line.
const control = /[\u0000-\u001f\u007f-\u009f]/g;
/** Bidirectional overrides and isolates, which could display a command or path reordered. */
const bidiControls = /[\u202a-\u202e\u2066-\u2069]/g;

/** Credential shapes found in commands, URLs and error text. Paths and hosts stay readable. */
const credentialPatterns: readonly [RegExp, string][] = [
  [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
    '[redacted private key]',
  ],
  // A credential rather than a word: a digit or an inner capital, so "Basic authentication
  // required" and "Token validation failed" stay readable.
  [
    /\b([Bb]earer|[Bb]asic|[Tt]oken)\s+(?=[\w.~+/=-]*(?:\d|[a-z][A-Z]))[\w.~+/=-]{8,}/g,
    '$1 [redacted]',
  ],
  [/\bsk-[\w-]{16,}/g, '[redacted]'],
  [/\bxai-[\dA-Za-z]{20,}/g, '[redacted]'],
  [/\b[rs]k_(?:live|test)_[\dA-Za-z]{16,}/g, '[redacted]'],
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[\dA-Za-z]{20,}/g, '[redacted]'],
  [/\bgithub_pat_\w{20,}/g, '[redacted]'],
  [/\bglpat-[\w-]{16,}/g, '[redacted]'],
  [/\bxox[abprs]-[\dA-Za-z-]{10,}/g, '[redacted]'],
  [/\bAKIA[\dA-Z]{16}\b/g, '[redacted]'],
  [/\bAIza[\w-]{30,}/g, '[redacted]'],
  [/\b(?:phx|phc)_[\dA-Za-z]{16,}/g, '[redacted]'],
  [/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, '[redacted]'],
  // A bounded scheme: an unbounded one rescans a long dotted or hyphenated run from every word.
  [/(\b[a-z][\d+.a-z-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[redacted]@'],
  [
    /([?&#;](?:access_token|refresh_token|id_token|token|api_key|apikey|key|secret|password|passwd|signature|sig|code|auth)=)[^\s"&#';]+/gi,
    '$1[redacted]',
  ],
  [
    /(--?(?:api-?key|access-?token|token|password|passwd|secret|auth-?token)(?:=|\s+))(?:"[^"]*"|'[^']*'|\S+)/gi,
    '$1[redacted]',
  ],
  [
    /\b([\dA-Z_]*(?:API_?KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIALS?)\s*=\s*)(?:"[^"]*"|'[^']*'|\S+)/g,
    '$1[redacted]',
  ],
  // Also quoted JSON keys and prefixed names such as "client_secret" or refresh_token: the match
  // starts at the key word, so a prefix stays as written.
  [
    /((?:api[_-]?key|access[_-]?token|auth[_-]?token|token|secret|password|passwd|pwd|authorization)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|\S+)/gi,
    '$1[redacted]',
  ],
];

/**
 * Pattern redaction, defense in depth after exact secret values are removed. Some shapes (a JWT)
 * rescan a long unbroken run from each place they could start, so give it bounded text, as
 * `activityLine` does.
 */
export const redactCredentials = (text: string) =>
  credentialPatterns.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    text,
  );

/** A multi-line secret (a PEM key) and each of its lines: a step keeps a single line of text. */
const secretParts = (value: string) =>
  value.includes('\n')
    ? [
        value,
        ...value
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length >= 8),
      ]
    : [value];

/** Exact secret values (at least four characters), longest first so prefixes cannot leak. */
export const redactValues = (text: string, values: Iterable<string | undefined>) =>
  [
    ...new Set(
      [...values]
        .filter((value): value is string => !!value && value.length >= 4)
        .flatMap(secretParts),
    ),
  ]
    .sort((a, b) => b.length - a.length)
    .reduce((current, secret) => current.split(secret).join('[redacted]'), text);

/** Shortens without splitting a surrogate pair. */
export const clipText = (text: string, max: number) =>
  text.length <= max
    ? text
    : `${text
        .slice(0, Math.max(0, max - 1))
        .replace(/[\uD800-\uDBFF]$/, '')
        .trimEnd()}…`;

/**
 * One line of public activity text: terminal formatting, control characters and credential
 * shapes removed, whitespace collapsed and bounded. Undefined when nothing printable remains.
 */
export const activityLine = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const plain = stripAnsi(value)
    .replace(bidiControls, '')
    .replace(control, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Credential shapes are matched only in a window well past the shown length, so their cost
  // stays bounded however long the text is. The margin covers redaction shrinking the text (a
  // whole private key) and pulling later characters into view; the word the window cuts is
  // dropped whole, since a credential split there would no longer match its shape.
  const reach = Math.max(4096, max * 16);
  const bounded = plain.length > reach ? `${plain.slice(0, reach).replace(/\S*$/, '')}…` : plain;
  const text = redactCredentials(bounded).replace(/\s+/g, ' ').trim();
  return text ? clipText(text, max) : undefined;
};
