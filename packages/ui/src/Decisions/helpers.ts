import type { Approval, Card, Snapshot } from '@pitchcrew/core';
import type { CardChange } from '../ChatView/job-changes.ts';
import { stepLabel, trackBeads, trackSteps, type BeadState } from '../ClayInterface/helpers.ts';
import type { PacketStage } from '../ClayInterface/packet-guidance.ts';
import { neededFiles } from '../components/InboxView/handoff.ts';

export type TimelineStep = {
  id: string;
  label: string;
  bead: BeadState;
  /** When the job first reached this step, from its saved history. */
  at?: string;
};

/**
 * The job's workflow track with the first time it reached each step. Dates come only from the
 * job's saved status moves (and its creation for Lead); a step without a saved move has no date.
 */
export const jobTimeline = (
  card: Card,
  changes: CardChange[] | undefined,
  stage?: PacketStage,
): TimelineStep[] => {
  const beads = trackBeads(card.state);
  const drafts = changes?.filter((change) => change.packet).length ?? 0;
  return trackSteps.map((step, index) => {
    const entered = changes?.find((change) => change.state && step.states.includes(change.state));
    const bead = beads[index] ?? 'todo';
    return {
      id: step.id,
      label:
        step.id === 'drafting' && bead === 'done' && drafts > 1
          ? `Drafted, ${drafts} drafts`
          : stepLabel(card.state, index, stage),
      bead,
      at: index === 0 ? card.createdAt : entered?.at,
    };
  });
};

const dayKey = (date: Date) => date.toDateString();
const shortDay = (date: Date, now: Date) =>
  date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });

/** Short relative date for one track step: now, minutes or hours ago today, then day and month. */
export const stepDate = (at: string, now = new Date()) => {
  const date = new Date(at);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'now';
  if (dayKey(date) !== dayKey(now)) return shortDay(date, now);
  return minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
};

/** The day once, for a track whose saved stamps all share it: Today, Yesterday or Oct 19. */
const dayLabel = (at: string, now: Date) => {
  const date = new Date(at);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(now)) return 'Today';
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
  return shortDay(date, now);
};

export type TrackDates = {
  /** Set when every dated step happened in the same minute: printed once beside the heading. */
  shared?: string;
  /** Each step's own short date, absent when shared or when the step has no saved move. */
  dates: (string | undefined)[];
};

/**
 * Dates for the job track. A track recorded all at once (an import or example data) prints its
 * day once instead of the same time on every step.
 */
export const trackDates = (stamps: (string | undefined)[], now = new Date()): TrackDates => {
  const dated = stamps.filter((at): at is string => !!at);
  const minute = (at: string) => Math.floor(new Date(at).getTime() / 60_000);
  const [first] = dated;
  if (first && dated.length > 1 && dated.every((at) => minute(at) === minute(first)))
    return { shared: dayLabel(first, now), dates: stamps.map(() => undefined) };
  return { dates: stamps.map((at) => (at ? stepDate(at, now) : undefined)) };
};

export type PacketCheck = { label: string; ok: boolean };

/**
 * Checks that were actually run on this approval's frozen files: document verification and the
 * confirmed form's uploads. Nothing is shown for checks that did not run.
 */
export const packetChecks = (approval: Approval, card: Card | undefined): PacketCheck[] => {
  const checks: PacketCheck[] = [];
  const reports = approval.documentVerification ?? [];
  if (reports.length) {
    const verified = reports.filter((report) => report.status === 'verified').length;
    checks.push({
      label: `${verified} of ${reports.length} documents readable`,
      ok: verified === reports.length,
    });
    const errors = reports
      .flatMap((report) => report.findings)
      .filter((f) => f.severity === 'error');
    checks.push({
      label: `${errors.length} document ${errors.length === 1 ? 'error' : 'errors'}`,
      ok: !errors.length,
    });
  }
  const uploads = neededFiles(card, approval)?.filter((file) => file.required);
  if (uploads?.length) {
    const covered = uploads.filter((file) => file.status === 'covered').length;
    checks.push({
      label: `${covered} of ${uploads.length} required uploads covered`,
      ok: covered === uploads.length,
    });
  }
  return checks;
};

export type ExportChoice = { formats: string[]; layout?: 'Formatted' | 'Plain text' };

/** Markdown is always exported; PDF/DOCX and their layout were fixed when approval was asked. */
export const exportChoice = (approval: Approval): ExportChoice => {
  const artifacts = approval.artifacts ?? [];
  const formats = ['Markdown'];
  if (artifacts.some((item) => item.mimeType === 'application/pdf')) formats.unshift('PDF');
  if (artifacts.some((item) => item.name.endsWith('.docx'))) formats.splice(-1, 0, 'DOCX');
  const layout = artifacts[0]?.layout ?? (artifacts.length ? 'formatted' : undefined);
  return {
    formats,
    layout: layout ? (layout === 'plain' ? 'Plain text' : 'Formatted') : undefined,
  };
};

/** The explicitly configured submission agent named on the handoff, or a generic agent. */
export const submitterName = (data: Pick<Snapshot, 'roles'>) => {
  const submitter = data.roles.find((role) => role.id === 'submitter' && !role.retiredAt);
  return submitter?.name ?? 'an agent';
};

/** Required personal answers still empty in the job's extracted brief. */
export const briefAnswersNeeded = (card: Card) =>
  (card.applicationContext?.requirements ?? []).filter(
    (item) => item.required && item.personal && !item.answer.trim(),
  ).length;
