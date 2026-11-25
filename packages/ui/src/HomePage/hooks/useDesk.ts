import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import type { AttentionItem, AttentionTier } from '@/lib/attention.ts';
import { attentionKindLabel, attentionSubject } from '@/lib/attention-labels.ts';
import { useNotificationStore } from '@/Notifications/store.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import {
  deskEntries,
  deskSections,
  foldTierOf,
  nextOpenKey,
  openRow,
  revealOpenRow,
  showsRow,
  tierGroups,
} from '../helpers.ts';
import { deskRecords } from '../records.ts';
import type { DeskEntry, DeskState, DeskView } from '../types.ts';
import { useDeskAnnouncer } from './useDeskAnnouncer.ts';
import { useDeskFocus } from './useDeskFocus.ts';
import { useDeskKeys } from './useDeskKeys.ts';
import { currentEntries, useDeskRecords } from './useDeskRecords.ts';
import { useItemParam, useWantedItem } from './useItemParam.ts';
import { usePressGuard } from './usePressGuard.ts';

const closed: DeskState = { openKey: null, armedAt: 0, visited: new Set(), unfolded: new Set() };

/** What the live region says opens next. */
const nextWords = (entries: readonly DeskEntry[], key: string | null) => {
  const entry = entries.find((candidate) => candidate.key === key);
  const data = useWorkspaceStore.getState().data;
  if (entry?.type !== 'live' || !data) return undefined;
  const from = entry.kept ?? data;
  return {
    subject: attentionSubject(entry.item, from),
    kind: attentionKindLabel(entry.item, from),
  };
};

/**
 * The desk: every row ranked with this session's records, one row open (the top one on load, or
 * `?item=`), the rows opened this visit kept mounted so drafts survive, and the folds. When the
 * open row leaves (decided here, or resolved anywhere else) the most urgent row still waiting
 * opens; after a desk decision its trigger takes focus, the outcome is said and a repeated click
 * on the deciding spot is dropped, and after any other departure the new row's body takes no
 * click for a moment. An open row that ranking moves behind a closed fold opens that fold.
 */
export const useDesk = (items: readonly AttentionItem[], tray: RefObject<HTMLElement | null>) => {
  const { records, flights } = useDeskRecords();
  const entries = useMemo(() => deskEntries(items, records, flights), [items, records, flights]);
  const sections = useMemo(() => deskSections(tierGroups(entries)), [entries]);
  const wanted = useWantedItem();
  const [desk, setDesk] = useState(() => {
    const key = wanted && showsRow(entries, wanted) ? wanted : nextOpenKey(entries);
    return openRow(closed, key, entries, performance.now());
  });
  const current = useRef(desk);
  // The record made while the desk was on screen; only it settles in, never on a later visit.
  const [fresh, setFresh] = useState(0);
  const focus = useDeskFocus(tray, useAppReducedMotion());
  const guard = usePressGuard(tray);
  const { said, say } = useDeskAnnouncer();
  const keys = useDeskKeys();
  const commit = useCallback((next: DeskState) => {
    current.current = next;
    setDesk(next);
  }, []);
  /** Opens a row from elsewhere (a since line or `?item=`), with its fold, and focuses it. */
  const show = (key: string) => {
    const now = currentEntries();
    if (!showsRow(now, key)) return;
    commit(openRow(current.current, key, now, performance.now()));
    requestAnimationFrame(() => focus.row(key));
  };
  useItemParam(wanted, show);
  useEffect(() => {
    let handled = deskRecords.store.getState().latest?.seq ?? 0;
    let flying: string | null = null;
    // The fold that held the open row at the last check, so a fold the user closed stays closed.
    const start = current.current.openKey;
    let held = { key: start, tier: foldTierOf(currentEntries(), start) };
    const check = () => {
      const now = currentEntries();
      const { openKey } = current.current;
      const { latest, flights: inFlight } = deskRecords.store.getState();
      const decided = latest && latest.seq > handled ? latest : null;
      if (decided) {
        handled = decided.seq;
        setFresh(decided.seq);
      }
      const landed = !!flying && flying === openKey && !inFlight[flying];
      flying = openKey && inFlight[openKey] ? openKey : null;
      if (openKey && !showsRow(now, openKey)) {
        const next = nextOpenKey(now);
        const mine = decided && decided.key === openKey ? decided : null;
        commit(openRow(current.current, next, now, mine ? mine.at : performance.now()));
        // Resolved elsewhere or expired: the next row opens where a click aimed at the row that
        // left may land, so its body takes no click for a moment.
        if (!mine) {
          guard.hold(next);
          return;
        }
        say(mine.text, nextWords(now, next));
        guard.arm(next, mine.startedAt);
        focus.settle(true);
        return;
      }
      // Ranking moved the open row behind a closed fold: the fold opens, so the row stays in view.
      const revealed = revealOpenRow(current.current, now, held.key === openKey ? held.tier : null);
      if (revealed !== current.current) commit(revealed);
      held = { key: openKey, tier: foldTierOf(now, openKey) };
      if (decided) say(decided.text);
      // A call that moved its item in place (an approved packet now to choose how to apply).
      if (landed) focus.settle(false);
    };
    const stops = [
      useWorkspaceStore.subscribe(check),
      deskRecords.store.subscribe(check),
      useNotificationStore.subscribe(check),
    ];
    return () => stops.forEach((stop) => stop());
  }, [commit, focus, guard, say]);
  const tools = useMemo(
    () => ({
      act: (view: DeskView) => deskRecords.deskAction(view),
      openCard: focus.openJob,
      lost: focus.lost,
      resolved: () => focus.settle(false),
    }),
    [focus],
  );
  return {
    entries,
    sections,
    desk,
    fresh,
    keys,
    said,
    tools,
    /** Opens one row, or none, as the user chose. */
    open: (key: string | null) => commit(openRow(current.current, key, entries, performance.now())),
    show,
    fold: (tier: AttentionTier, unfold: boolean) => {
      const { unfolded } = current.current;
      const next = new Set(unfolded);
      if (unfold) next.add(tier);
      else next.delete(tier);
      commit({ ...current.current, unfolded: next });
    },
  };
};

export type Desk = ReturnType<typeof useDesk>;
