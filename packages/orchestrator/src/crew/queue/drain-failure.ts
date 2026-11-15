import type { CrewContext } from '../types.ts';

const lastFailure = new WeakMap<CrewContext, string>();
/** Drains start detached from many call sites; a rejection would end a background-service daemon. */
export const reportDrainFailure = (context: CrewContext, drain: string, error: unknown): void => {
  if (context.closing) return;
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  const line = `Queue drain failed (${drain}): ${detail}`;
  // The scheduler retries every second; repeat an identical failure only once.
  if (lastFailure.get(context) === line) return;
  lastFailure.set(context, line);
  console.error(line);
};
