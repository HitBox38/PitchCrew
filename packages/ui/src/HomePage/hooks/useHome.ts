import { useMemo } from 'react';
import type { Snapshot } from '@pitchcrew/core';
import { useAttention } from '@/hooks/useAttention.ts';
import type { AttentionItem } from '@/lib/attention.ts';
import {
  sinceLines,
  sinceSummary,
  sinceWindow,
  type SinceLine,
  type SinceWindow,
} from '@/lib/since.ts';
import { useClock } from '@/lib/time.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { railModel } from '../components/HomeRail/helpers.ts';
import type { RailModel } from '../components/HomeRail/types.ts';
import { useHomeSeen } from './useHomeSeen.ts';

export type HomeSince = { range: SinceWindow; lines: SinceLine[]; summary: string };

export type HomeModel = {
  data: Snapshot;
  items: readonly AttentionItem[];
  now: number;
  rail: RailModel;
  since: HomeSince;
};

/**
 * Home's inputs: the workspace snapshot, the one ranked attention list the shell's Home badge
 * also counts, and the time ages count from. That time is the half minute the shared clock last
 * ticked (it counts half minutes), so rendering stays pure and every age moves together. From
 * them, once per snapshot: the crew rail and what was recorded since this device last showed Home.
 */
export const useHome = (): HomeModel | null => {
  const data = useWorkspaceStore((state) => state.data);
  const items = useAttention();
  const now = useClock() * 30_000;
  const seen = useHomeSeen();
  const rail = useMemo(() => (data ? railModel(data, items) : null), [data, items]);
  const range = useMemo(() => sinceWindow(seen, now), [seen, now]);
  const lines = useMemo(
    () => (data ? sinceLines(data, range.from, items) : []),
    [data, range.from, items],
  );
  const since = useMemo(() => ({ range, lines, summary: sinceSummary(lines) }), [range, lines]);
  return data && rail ? { data, items, now, rail, since } : null;
};
