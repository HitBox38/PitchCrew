/** Lightweight transcript positions shared by the saved-history index and live renderer. */
export interface TranscriptMessagePosition {
  id: string;
  createdAt: string;
  sender: string;
  recipient?: string;
  runId: string | null;
  notification?: string | null;
  userInput?: string | null;
  content?: string;
  /** The server's indexed presentation time, retained when merging a partial history page. */
  positionedAt?: string;
}
export interface TranscriptRunPosition {
  id: string;
  roleId: string;
  startedAt: string;
  status: string;
  requestId?: string | null;
}
export interface TranscriptRequestPosition {
  id: string;
  messageId: string;
  deliveries: { runId: string | null }[];
}
export interface TranscriptPosition {
  kind: 'message' | 'turn';
  id: string;
  createdAt: string;
  runId: string | null;
}

/** Settled activity belongs to its own final answer; active work stays chronological. */
export const transcriptOrder = (
  messages: TranscriptMessagePosition[],
  runs: TranscriptRunPosition[],
  context: {
    requests?: TranscriptRequestPosition[];
    dispatchRuns?: TranscriptRunPosition[];
  } = {},
): TranscriptPosition[] => {
  const stopped = new Set(runs.filter((run) => run.status === 'cancelled').map((run) => run.id));
  const visible = messages.filter(
    (message) =>
      !(
        message.sender === 'system' &&
        message.content === 'Run cancelled.' &&
        stopped.has(message.runId ?? '')
      ),
  );
  const dispatched = dispatchPositions(context.requests ?? [], context.dispatchRuns ?? runs);
  const position = (message: TranscriptMessagePosition) =>
    message.positionedAt ??
    (message.sender === 'user' ? dispatched.get(message.id) : undefined) ??
    message.createdAt;
  const triggers = new Map<string, string>();
  const finalReplies = new Map<string, TranscriptMessagePosition>();
  for (const message of visible) {
    if (!message.runId) continue;
    if (message.sender === 'user') {
      if (!triggers.has(message.runId)) triggers.set(message.runId, position(message));
    } else if (message.sender !== 'system' && !message.notification && !message.userInput) {
      finalReplies.set(message.runId, message);
    }
  }
  const entries: TranscriptPosition[] = visible.map((message) => ({
    kind: 'message',
    id: message.id,
    createdAt: position(message),
    runId: message.runId,
  }));
  const attached = new Map<string, TranscriptPosition>();
  for (const run of runs) {
    const answer = finalReplies.get(run.id);
    const joined = answer?.sender === run.roleId && !['running', 'waiting'].includes(run.status);
    const item: TranscriptPosition = {
      kind: 'turn',
      id: `turn-${run.id}`,
      runId: run.id,
      createdAt: joined ? answer.createdAt : (triggers.get(run.id) ?? run.startedAt),
    };
    if (joined) attached.set(answer.id, item);
    else entries.push(item);
  }
  const senders = new Map(visible.map((message) => [message.id, message.sender]));
  const positionedInputs = new Set(
    visible
      .filter(
        (message) =>
          message.sender === 'user' && (message.positionedAt || dispatched.has(message.id)),
      )
      .map((message) => message.id),
  );
  const rank = (item: TranscriptPosition) =>
    item.kind === 'turn' ? 1 : ['user', 'system'].includes(senders.get(item.id) ?? '') ? 0 : 2;
  const starts = new Map((context.dispatchRuns ?? runs).map((run) => [run.id, run.startedAt]));
  const priorAnswer = (answer: TranscriptPosition, input: TranscriptPosition) =>
    answer.kind === 'message' &&
    !['user', 'system'].includes(senders.get(answer.id) ?? '') &&
    !!answer.runId &&
    (starts.get(answer.runId) ?? answer.createdAt) < input.createdAt &&
    (input.kind === 'turn' || positionedInputs.has(input.id));
  return entries
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) ||
        (priorAnswer(a, b) ? -1 : priorAnswer(b, a) ? 1 : rank(a) - rank(b)),
    )
    .flatMap((item) => (attached.has(item.id) ? [attached.get(item.id)!, item] : [item]));
};

/** Retry pointers can change; saved request IDs retain the first actual delivery. */
const dispatchPositions = (
  requests: TranscriptRequestPosition[],
  runs: TranscriptRunPosition[],
) => {
  const byRun = new Map(runs.map((run) => [run.id, run]));
  const byRequest = new Map<string, string>();
  const earlier = (a: string | undefined, b: string) => (!a || b < a ? b : a);
  for (const run of runs) {
    if (run.requestId)
      byRequest.set(run.requestId, earlier(byRequest.get(run.requestId), run.startedAt));
  }
  const positions = new Map<string, string>();
  for (const request of requests) {
    let startedAt = byRequest.get(request.id);
    for (const delivery of request.deliveries) {
      const run = delivery.runId ? byRun.get(delivery.runId) : undefined;
      if (run) startedAt = earlier(startedAt, run.startedAt);
    }
    if (startedAt)
      positions.set(request.messageId, earlier(positions.get(request.messageId), startedAt));
  }
  return positions;
};

/** At most one extra context row keeps a settled turn and its answer on the same page. */
export const transcriptWindow = <T extends Pick<TranscriptPosition, 'id' | 'kind' | 'createdAt'>>(
  items: T[],
  anchor: string | null,
  limit = 50,
  canJoin: (previous: T, current: T) => boolean = () => false,
) => {
  const joined = (index: number) => {
    const previous = items[index - 1];
    const current = items[index];
    return !!previous && !!current && canJoin(previous, current);
  };
  const found = anchor === null ? -1 : items.findIndex((item) => item.id === anchor);
  let start = found < 0 ? Math.max(0, items.length - limit) : found;
  if (joined(start)) start -= 1;
  let end = found < 0 ? items.length : Math.min(items.length, found + limit);
  // Retain the requested range when adding preceding context. If both edges join,
  // leave the final pair for the next page rather than exceeding one extra row.
  if (joined(end)) end += end - start < limit + 1 ? 1 : -1;
  return {
    start,
    end,
    items: items.slice(start, end),
    older: start > 0 ? items[Math.max(0, start - limit)].id : null,
    newer: end < items.length ? items[end].id : null,
    latest: anchor === null || found < 0,
  };
};
