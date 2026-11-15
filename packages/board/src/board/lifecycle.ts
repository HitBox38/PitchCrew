import {
  cardLifecycle,
  crewTransitions,
  deliveryLifecycle,
  entityLifecycles,
  LifecycleError,
  type BoardEvent,
  type CardState,
  type ChatRequest,
} from '@pitchcrew/core';
import type { BoardContext } from './types.ts';

/**
 * `enforce` refuses a status move its table does not declare; `report` saves it and warns once;
 * `off` skips the check. Tests enforce, so a new move must be added to the table. Installed
 * daemons report, so a move the tables missed never stops a user's work.
 */
export type LifecycleMode = 'enforce' | 'report' | 'off';

export const lifecycleMode = (): LifecycleMode => {
  const mode = process.env.PITCHCREW_LIFECYCLES;
  return mode === 'enforce' || mode === 'off' ? mode : 'report';
};

type Guarded = keyof typeof entityLifecycles;
const guarded = (kind: string): kind is Guarded => Object.hasOwn(entityLifecycles, kind);

const saved = <T>(context: BoardContext, kind: string, id: string): T | undefined => {
  const row = context.db
    .prepare('SELECT json FROM entities WHERE kind = ? AND id = ?')
    .get(kind, id) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as T) : undefined;
};

/** Undeclared status moves this write would make. Creation and unchanged statuses never count. */
export const lifecycleViolations = (
  context: BoardContext,
  kind: BoardEvent['kind'],
  data: BoardEvent['data'],
): LifecycleError[] => {
  if (kind === 'chat_request') {
    const before = saved<ChatRequest>(context, kind, data.id);
    if (!before) return [];
    return (data as ChatRequest).deliveries.flatMap((delivery) => {
      const from = before.deliveries.find((item) => item.roleId === delivery.roleId)?.status;
      return !from || deliveryLifecycle.can(from, delivery.status)
        ? []
        : [
            new LifecycleError(
              deliveryLifecycle.name,
              from,
              delivery.status,
              deliveryLifecycle.next(from),
            ),
          ];
    });
  }
  if (!guarded(kind)) return [];
  const lifecycle = entityLifecycles[kind];
  const from = saved<{ status?: string }>(context, kind, data.id)?.status;
  const to = (data as { status?: string }).status;
  if (from === undefined || to === undefined || from === to) return [];
  const next = (lifecycle.graph as Record<string, readonly string[]>)[from] ?? [];
  return next.includes(to) ? [] : [new LifecycleError(lifecycle.name, from, to, next)];
};

/** Called inside the write transaction, before the event is appended. */
export const guardLifecycle = (
  context: BoardContext,
  kind: BoardEvent['kind'],
  data: BoardEvent['data'],
): void => handleViolations(context, lifecycleViolations(context, kind, data));

/**
 * Checks a job status written by crew work against the workflow graph plus its rework moves.
 * User and `manageWorkflow` corrections record jobs directly and are not checked here.
 */
export const guardCrewMove = (context: BoardContext, from: CardState, to: CardState): void =>
  handleViolations(
    context,
    from === to || crewTransitions(from).includes(to)
      ? []
      : [new LifecycleError(cardLifecycle.name, from, to, crewTransitions(from))],
  );

const handleViolations = (context: BoardContext, violations: LifecycleError[]): void => {
  if (context.lifecycleMode === 'off') return;
  for (const violation of violations) {
    if (context.lifecycleMode === 'enforce') throw violation;
    const key = `${violation.lifecycle}:${violation.from}:${violation.to}`;
    if (context.lifecycleReports.has(key)) continue;
    context.lifecycleReports.add(key);
    console.warn(`Pitchcrew lifecycle: ${violation.message}`);
    try {
      context.onLifecycleReport?.(violation);
    } catch {
      /* Reporting is best effort and never blocks the write. */
    }
  }
};
