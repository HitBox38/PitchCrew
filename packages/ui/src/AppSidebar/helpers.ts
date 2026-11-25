import { attentionCounts, type AttentionItem } from '../lib/attention.ts';
import type { SidebarCounts } from './types.ts';

/**
 * Badge counts for the sidebar, all from the one attention list: Home counts everything waiting
 * on the user (the same number as Home's title fact and list), Crew its updates and proposals,
 * Profile its updates to review or recover, and Skills its updates (shown in More).
 */
export const sidebarCounts = (items: readonly AttentionItem[]): SidebarCounts => {
  const { home, crew, profile, skills } = attentionCounts(items);
  return { home, crew, profile, skills };
};

/** Accessible name for a counted nav row, e.g. “Crew, 2 updates or proposals”. */
export const countedLabel = (label: string, count: number, noun: string) =>
  count ? `${label}, ${count} ${noun}` : label;
