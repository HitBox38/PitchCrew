/** Pure transcript visibility shared by saved history and live rendering. */
export interface TranscriptVisibilityMessage {
  id: string;
  threadId: string;
  sender: string;
  recipient: string;
  runId: string | null;
  content: string;
  createdAt: string;
  referencesKey: string;
  hasAttachments: boolean;
  hasUserInput: boolean;
  hasNotification: boolean;
}
export interface TranscriptVisibilityTask {
  parentRunId: string;
  threadId: string;
  roleId: string;
  trigger: string;
  content: string;
}
export interface TranscriptVisibilityRequest {
  id?: string;
  messageId: string;
  deliveries: readonly { runId: string | null; status: string }[];
}
type ByRecipient = Map<string, string>;
type ByReferences = Map<string, ByRecipient>;
type BySender = Map<string, ByReferences>;
interface RunBucket {
  tasks: Map<string, Set<string>>;
  sources: Map<string, BySender>;
}

/** Linear in rows + content/reference sizes, including repeated content within one run. */
export const hiddenTranscriptMessageIds = (
  messages: readonly TranscriptVisibilityMessage[],
  tasks: readonly TranscriptVisibilityTask[],
  requests: readonly TranscriptVisibilityRequest[],
  startedRequestIds: ReadonlySet<string> = new Set(),
): Set<string> => {
  const hidden = new Set<string>();
  const unsent = new Set(
    requests
      .filter(
        (request) =>
          (!request.id || !startedRequestIds.has(request.id)) &&
          request.deliveries.length > 0 &&
          request.deliveries.every(
            (delivery) =>
              !delivery.runId && ['queued', 'paused', 'failed'].includes(delivery.status),
          ),
      )
      .map((request) => request.messageId),
  );
  const runs = new Map<string, Map<string, RunBucket>>();
  const bucket = (threadId: string, runId: string): RunBucket => {
    let thread = runs.get(threadId);
    if (!thread) runs.set(threadId, (thread = new Map()));
    let run = thread.get(runId);
    if (!run) thread.set(runId, (run = { tasks: new Map(), sources: new Map() }));
    return run;
  };
  for (const task of tasks) {
    if (task.trigger !== 'message') continue;
    const run = bucket(task.threadId, task.parentRunId);
    let recipients = run.tasks.get(task.content);
    if (!recipients) run.tasks.set(task.content, (recipients = new Set()));
    recipients.add(task.roleId);
  }
  const referenceTargets = new Map<string, readonly string[]>();
  const targets = (key: string) => {
    let known = referenceTargets.get(key);
    if (known) return known;
    let references: unknown;
    try {
      references = JSON.parse(key);
    } catch {
      references = [];
    }
    known = Array.isArray(references)
      ? [
          ...new Set(
            references.flatMap((reference) =>
              reference &&
              typeof reference === 'object' &&
              reference.kind === 'agent' &&
              typeof reference.id === 'string'
                ? [reference.id]
                : [],
            ),
          ),
        ]
      : [];
    referenceTargets.set(key, known);
    return known;
  };
  for (const message of messages) {
    if (message.sender === 'user' && unsent.has(message.id)) hidden.add(message.id);
    if (
      !message.runId ||
      ['user', 'system'].includes(message.sender) ||
      !['user', 'crew'].includes(message.recipient)
    )
      continue;
    const run = bucket(message.threadId, message.runId);
    // A canonical row can only hide a forward if an exact matching task exists.
    const recipients = run.tasks.get(message.content);
    if (!recipients) continue;
    let senders = run.sources.get(message.content);
    if (!senders) run.sources.set(message.content, (senders = new Map()));
    let referenceGroups = senders.get(message.sender);
    if (!referenceGroups) senders.set(message.sender, (referenceGroups = new Map()));
    let earliest = referenceGroups.get(message.referencesKey);
    if (!earliest) referenceGroups.set(message.referencesKey, (earliest = new Map()));
    for (const recipient of targets(message.referencesKey)) {
      if (!recipients.has(recipient)) continue;
      const before = earliest.get(recipient);
      if (before === undefined || message.createdAt < before)
        earliest.set(recipient, message.createdAt);
    }
  }
  for (const message of messages) {
    if (
      !message.runId ||
      ['user', 'system'].includes(message.sender) ||
      ['user', 'crew'].includes(message.recipient) ||
      message.hasAttachments ||
      message.hasUserInput ||
      message.hasNotification
    )
      continue;
    const run = runs.get(message.threadId)?.get(message.runId);
    if (!run?.tasks.get(message.content)?.has(message.recipient)) continue;
    const at = run.sources
      .get(message.content)
      ?.get(message.sender)
      ?.get(message.referencesKey)
      ?.get(message.recipient);
    if (at !== undefined && at <= message.createdAt) hidden.add(message.id);
  }
  return hidden;
};
