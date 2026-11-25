import { createStore } from 'zustand/vanilla';
import type { Snapshot } from '@pitchcrew/core';
import { cachedAttention, type AttentionItem } from '@/lib/attention.ts';
import { attentionKindLabel, attentionSubject } from '@/lib/attention-labels.ts';
import { useNotificationStore } from '@/Notifications/store.ts';
import { ActionRefreshError } from '@/WorkspaceStore/action-errors.ts';
import { useWorkspaceStore, type Action } from '@/WorkspaceStore/index.ts';
import { deskOutcome } from './outcomes.ts';
import type { DeskCall, DeskDecided, DeskFlight, DeskRecord, DeskView } from './types.ts';

// Record lines (decision 5): a decision made on the desk leaves one line with its consequence
// where the row stood. In memory only, so records survive route changes in this app session and
// are gone on reload. A brief confirmed in job details opened from its row counts as decided on the
// desk; items resolved anywhere else simply leave the list.

export type DeskRecordsState = {
  /** One record per item key per session; deciding a key that came back replaces it. */
  records: Record<string, DeskRecord>;
  /** Keys with a desk call in flight; their rows stay drawn from the kept view. */
  flights: Record<string, DeskFlight>;
  /** Successful calls on keys still waiting (an approved packet now to choose how to apply). */
  calls: Record<string, DeskCall[]>;
  /**
   * Calls the daemon saved while the reload failed. They settle once a snapshot without the item
   * arrives, or count as moved in place after `settleMs` (a few polls); a later call supersedes them.
   */
  unsettled: Record<string, { view: DeskView; until: number }>;
  /** The newest record, for the desk to open the next row, say it and guard the spot. */
  latest: DeskDecided | null;
  /**
   * Rows whose decision happens in job details opened from the desk (a brief to confirm): a
   * record once the item leaves and `done` holds; dropped `settleMs` after job details closes.
   */
  watched: Record<string, { view: DeskView; done: (fresh: Snapshot) => boolean; until: number }>;
};

/** Where the desk reads the workspace: its action, its snapshot and the attention list. */
export type DeskWorkspace = {
  action: () => Action;
  data: () => Snapshot | null;
  items: (data: Snapshot) => readonly AttentionItem[];
  /** Calls back on every snapshot change. */
  subscribe: (listener: () => void) => () => void;
  /** `performance.now()`, injectable for tests. */
  now?: () => number;
};

/** How long a call saved while the reload failed waits for a snapshot that shows its result. */
const settleMs = 10_000;

const empty: DeskRecordsState = {
  records: {},
  flights: {},
  calls: {},
  unsettled: {},
  latest: null,
  watched: {},
};
const without = <T>(map: Record<string, T>, key: string) => {
  const { [key]: _gone, ...rest } = map;
  return rest;
};

export const createDeskRecords = (workspace: DeskWorkspace) => {
  const store = createStore<DeskRecordsState>(() => empty);
  const now = workspace.now ?? (() => performance.now());
  let seq = 0;
  const live = (data: Snapshot | null, key: string) =>
    !!data && workspace.items(data).some((item) => item.key === key);

  /** The state with a call's flight ended; a flight ends when its last call does. */
  const land = (state: DeskRecordsState, key: string, held: boolean) => {
    if (!held) return state.flights;
    const flight = state.flights[key];
    if (!flight || flight.count <= 1) return without(state.flights, key);
    return { ...state.flights, [key]: { ...flight, count: flight.count - 1 } };
  };

  /** A record for a key that left the list, or none while it still waits. */
  const record = (view: DeskView, calls: DeskCall[], fresh: Snapshot, startedAt: number) => {
    const items = workspace.items(fresh);
    if (items.some((item) => item.key === view.item.key)) return null;
    const outcome = deskOutcome(view, calls, fresh, items);
    const { item } = view;
    const made: DeskRecord = {
      key: item.key,
      kind: item.kind,
      tier: item.tier,
      askedAt: item.askedAt,
      expiresAt: item.expiresAt,
      queueId: item.queueId,
      tone: item.tone,
      subject: attentionSubject(item, view.data),
      label: attentionKindLabel(item, view.data),
      text: outcome.text,
      bead: outcome.bead,
      decidedAt: new Date().toISOString(),
      seq: (seq += 1),
      calls,
      view,
    };
    const latest: DeskDecided = {
      key: item.key,
      seq: made.seq,
      text: made.text,
      startedAt,
      at: now(),
    };
    return { made, latest };
  };

  /** A later call on a decided key (a Skip's queue resume) amends its record's calls and words. */
  const amend = (existing: DeskRecord, call: DeskCall, fresh: Snapshot | null) => {
    const calls = [...existing.calls, call];
    const text = fresh
      ? deskOutcome(existing.view, calls, fresh, workspace.items(fresh)).text
      : existing.text;
    return { ...existing, calls, text };
  };

  /**
   * The store's `action` for one item: it forwards the path, method, body and options unchanged,
   * so it never changes what is sent. A decision whose item leaves the list is said by its record
   * line and the desk's live region, so its success toast is dropped. One that leaves the item in
   * place makes no record: the row itself changes (an approved packet now reads "Choose how to
   * apply", which its trigger names when it takes focus back), and a component that sends its own
   * success toast (Refresh comparison) keeps it. Either way it is said once. Error toasts stay.
   */
  const deskAction =
    (view: DeskView): Action =>
    async (path, method = 'POST', body, success, options) => {
      const key = view.item.key;
      // Worded after the store's reload, once the fresh snapshot says whether the item stayed.
      const toast =
        success === undefined
          ? undefined
          : (result: unknown) => {
              if (!live(workspace.data(), key)) return '';
              return typeof success === 'function' ? success(result) : success;
            };
      const call: DeskCall = { path, method, body };
      const startedAt = now();
      const before = store.getState();
      const since = seq;
      // A call on a key already decided and gone (Skip's trailing resume) only amends its record.
      const trailing = !!before.records[key] && !live(workspace.data(), key);
      if (!trailing) {
        const flight = before.flights[key];
        store.setState({
          flights: { ...before.flights, [key]: { view, count: (flight?.count ?? 0) + 1 } },
        });
      }
      try {
        const result = await workspace.action()(path, method, body, toast, options);
        settle(view, call, startedAt, since, trailing);
        return result;
      } catch (error) {
        const state = store.getState();
        const saved = error instanceof ActionRefreshError;
        const existing = trailing ? state.records[key] : undefined;
        store.setState({
          flights: land(state, key, !trailing),
          // A trailing call amends its record either way: saved (only the reload failed), or
          // refused, which the record then says (a Skip whose queue resume failed). The workspace
          // still shows the error.
          ...(existing
            ? {
                records: {
                  ...state.records,
                  [key]: amend(
                    existing,
                    saved ? call : { ...call, failed: true },
                    workspace.data(),
                  ),
                },
              }
            : saved
              ? {
                  calls: { ...state.calls, [key]: [...(state.calls[key] ?? []), call] },
                  unsettled: { ...state.unsettled, [key]: { view, until: now() + settleMs } },
                }
              : {}),
        });
        throw error;
      }
    };

  const settle = (
    view: DeskView,
    call: DeskCall,
    startedAt: number,
    since: number,
    trailing: boolean,
  ) => {
    const key = view.item.key;
    const state = store.getState();
    const fresh = workspace.data();
    const flights = land(state, key, !trailing);
    // A later call on the key supersedes one still waiting for its result.
    const unsettled = without(state.unsettled, key);
    const existing = state.records[key];
    // At most one record per key per session: calls after it was made amend it.
    if (existing && (trailing || existing.seq > since)) {
      store.setState({
        flights,
        unsettled,
        records: { ...state.records, [key]: amend(existing, call, fresh) },
      });
      return;
    }
    const calls = [...(state.calls[key] ?? []), call];
    const made = fresh ? record(view, calls, fresh, startedAt) : null;
    if (!made) {
      store.setState({ flights, unsettled, calls: { ...state.calls, [key]: calls } });
      return;
    }
    store.setState({
      flights,
      unsettled,
      calls: without(state.calls, key),
      records: { ...state.records, [key]: made.made },
      latest: made.latest,
    });
  };

  /**
   * Calls saved while the reload failed: a snapshot without the item records them; while the item
   * is still listed they keep waiting, and after `settleMs` they count as moved in place. Chat
   * stream updates also reach here, so a snapshot that still lists the item proves nothing.
   */
  const settleUnsettled = () => {
    const state = store.getState();
    const fresh = workspace.data();
    const keys = Object.keys(state.unsettled);
    const watched = Object.keys(state.watched);
    if ((!keys.length && !watched.length) || !fresh) return;
    let next = state;
    for (const key of watched) {
      const { view, done, until } = state.watched[key]!;
      const left = !live(fresh, key);
      if (!left && now() < until) continue;
      const made = left && done(fresh) ? record(view, [], fresh, now()) : null;
      next = {
        ...next,
        watched: without(next.watched, key),
        ...(made ? { records: { ...next.records, [key]: made.made }, latest: made.latest } : {}),
      };
    }
    for (const key of keys) {
      const { view, until } = state.unsettled[key]!;
      const made = record(view, next.calls[key] ?? [], fresh, now());
      if (!made && now() < until) continue;
      next = {
        ...next,
        unsettled: without(next.unsettled, key),
        ...(made
          ? {
              calls: without(next.calls, key),
              records: { ...next.records, [key]: made.made },
              latest: made.latest,
            }
          : {}),
      };
    }
    if (next !== state) store.setState(next);
  };
  workspace.subscribe(settleUnsettled);

  /** Job details opened from this row decides it; `done` says the fresh snapshot shows it decided. */
  const watch = (view: DeskView, done: (fresh: Snapshot) => boolean) => {
    const state = store.getState();
    store.setState({
      watched: { ...state.watched, [view.item.key]: { view, done, until: Infinity } },
    });
  };
  /** Job details closed: watched rows get a few polls to show their result, then are dropped. */
  const release = () => {
    const state = store.getState();
    const until = now() + settleMs;
    const watched = Object.fromEntries(
      Object.entries(state.watched).map(([key, entry]) => [
        key,
        { ...entry, until: Math.min(entry.until, until) },
      ]),
    );
    store.setState({ watched });
    settleUnsettled();
  };

  return { store, deskAction, settleUnsettled, watch, release };
};

/** The app's desk records, bound to the workspace store and the shared attention list. */
export const deskRecords = createDeskRecords({
  action: () => useWorkspaceStore.getState().action,
  data: () => useWorkspaceStore.getState().data,
  items: (data) => cachedAttention(data, useNotificationStore.getState().remoteRequests),
  subscribe: (listener) => useWorkspaceStore.subscribe(listener),
});

/** Queues the user released from the desk this session (answered or recovered), for Up next. */
export const releasedQueues = (records: Readonly<Record<string, DeskRecord>>) =>
  new Set(
    Object.values(records).flatMap((record) =>
      (record.kind === 'failure' || record.kind === 'question') && record.queueId
        ? [record.queueId]
        : [],
    ),
  );
