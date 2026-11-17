import type { Run, RunActivity } from '@pitchcrew/core';
import { isUserControlPause } from '@pitchcrew/core/browser-errors';

// A live failure stays previewed while it is among the latest three tool steps (thinking markers
// and commentary do not count), so its reason does not vanish the moment work moves on. A
// completed turn keeps only its latest failure, since the agent recovered from the earlier ones;
// a turn that failed, stopped or waits keeps up to its latest three.
const recentFailures = 3;

/**
 * The collapsed turn's context, in original order. While it runs: the latest commentary, a recent
 * failure and the current step. A request awaiting the user's OK shows its own step (`asked`: the
 * ids blockedSteps found), so the preview reads the same whether or not the agent has started
 * waiting on it; while the user holds the page, the last finished step, since the call blocked on
 * them is not work. Once settled: its latest failure (up to three unless the turn completed), or
 * else the latest interrupted step that is not a pause for the user's control.
 */
export const activityPreview = (
  run: Run,
  waiting = false,
  asked?: ReadonlySet<string>,
): RunActivity[] => {
  const entries = run.activity ?? [];
  if (run.status !== 'running') {
    const failures = entries
      .filter((entry) => entry.status === 'failed')
      .slice(run.status === 'completed' ? -1 : -recentFailures);
    if (failures.length) return failures;
    const issue = entries.findLast(
      (entry) => entry.status === 'interrupted' && !isUserControlPause(entry),
    );
    return issue ? [issue] : [];
  }
  const steps = entries.filter((entry) => entry.kind !== 'commentary');
  const commentary = entries.findLast((entry) => entry.kind === 'commentary' && entry.text?.trim());
  // Only tool steps can fail, and only they push a failure out of view: thinking markers come
  // between most calls, so counting them would halve the window for reasoning runtimes.
  const failure = entries
    .filter((entry) => entry.kind === 'tool')
    .slice(-recentFailures)
    .findLast((entry) => entry.status === 'failed');
  const request = asked?.size ? entries.findLast((entry) => asked.has(entry.id)) : undefined;
  const step =
    request ??
    (waiting
      ? steps.findLast((entry) => entry.status !== 'running')
      : (steps.findLast((entry) => entry.status === 'running') ?? steps.at(-1)));
  const ids = new Set([commentary?.id, failure?.id, step?.id]);
  return entries.filter((entry) => ids.has(entry.id));
};

export const activitySummary = (entries: RunActivity[]) => {
  const steps = entries.filter((entry) => entry.kind !== 'commentary').length;
  const updates = entries.filter(
    (entry) => entry.kind === 'commentary' && entry.text?.trim(),
  ).length;
  const failed = entries.filter((entry) => entry.status === 'failed').length;
  const interrupted = entries.filter(
    (entry) => entry.status === 'interrupted' && !isUserControlPause(entry),
  ).length;
  // Waits for the user's control can repeat or interleave with other steps within one takeover,
  // so the summary says it happened rather than claiming a count it cannot know.
  const paused = entries.some(isUserControlPause);
  return [
    steps ? `${steps} ${steps === 1 ? 'step' : 'steps'}` : '',
    updates ? `${updates} ${updates === 1 ? 'update' : 'updates'}` : '',
    failed ? `${failed} failed` : '',
    interrupted ? `${interrupted} interrupted` : '',
    paused ? 'paused while you had control' : '',
  ]
    .filter(Boolean)
    .join(' · ');
};

/**
 * The steps blocked on the user: running browser calls whose labels are the ones that wait on
 * them (the waiting request's own call, or every browser call while they hold the page). Matched
 * exactly, never guessed from order, so a parallel call keeps its own state; only browser rows
 * (and older saved steps, which carry no kind) can match, so a runtime's own tool whose words
 * happen to equal a browser label never waits. A request that has been asked ("Asked to click
 * …") but not yet carried out waits too, whatever the agent does next. Once its call runs, that
 * running row is the one waiting; until then only the turn's single latest asked row, since an
 * earlier identical request may have lapsed. Computed once over the whole turn and passed down,
 * never per group of steps.
 */
export const blockedSteps = (
  entries: RunActivity[],
  labels: readonly string[] | undefined,
): ReadonlySet<string> => {
  const browser = entries.filter(
    (entry) => entry.kind === 'tool' && (entry.tool ?? 'browser') === 'browser',
  );
  const running = browser.filter(
    (entry) => entry.status === 'running' && labels?.includes(entry.label),
  );
  if (running.length) return new Set(running.map((entry) => entry.id));
  const asked = (labels ?? []).filter((label) => label.startsWith('Asked to '));
  const latest = browser.findLast(
    (entry) => entry.status === 'completed' && asked.includes(entry.label),
  );
  return new Set(latest ? [latest.id] : []);
};
