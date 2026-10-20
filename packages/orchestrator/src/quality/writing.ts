import { randomUUID } from 'node:crypto';
import type { WritingGuide, WritingPreference, WritingCorrection } from '@pitchcrew/core';
import type { CrewContext } from '../crew/types.ts';

export function writingGuide(context: CrewContext): WritingGuide {
  return (
    context.board.list<WritingGuide>('writing_guide')[0] ?? {
      id: 'writing-guide',
      revision: 0,
      automatic: true,
      learningSince: new Date().toISOString(),
      preferences: [],
      proposals: [],
    }
  );
}
export function saveGuide(context: CrewContext, guide: WritingGuide, actor: string) {
  if (guide.preferences.length > 100 || guide.proposals.length > 100)
    throw new Error('The writing guide limit is 100 preferences and 100 proposals.');
  const next = { ...guide, revision: guide.revision + 1 };
  context.board.record('writing_guide', next, actor, 'Updated writing preferences');
  return next;
}
export function checkGuideRevision(context: CrewContext, revision: number) {
  const guide = writingGuide(context);
  if (guide.revision !== revision)
    throw new Error('The writing guide changed. Refresh and try again.');
  return structuredClone(guide);
}
export function addPreference(
  guide: WritingGuide,
  text: string,
  scope: WritingPreference['scope'],
  origin: WritingPreference['origin'],
  correctionIds: string[] = [],
) {
  const existing = guide.preferences.find((p) => p.text === text && p.scope === scope);
  if (existing) {
    if (origin === 'explicit') {
      existing.enabled = true;
      existing.origin = 'explicit';
    }
    return existing;
  }
  const item: WritingPreference = {
    id: randomUUID(),
    text,
    scope,
    origin,
    enabled: true,
    correctionIds,
    createdAt: new Date().toISOString(),
  };
  guide.preferences.push(item);
  return item;
}
export function guideForRun(context: CrewContext) {
  const guide = writingGuide(context);
  return {
    revision: guide.revision,
    preferences: guide.preferences
      .filter((p) => p.enabled)
      .sort((a, b) => Number(b.origin === 'explicit') - Number(a.origin === 'explicit')),
  };
}
export function finishWritingCorrection(
  context: CrewContext,
  id: string,
  packet: { resume: string; coverLetter: string },
) {
  const correction = context.board.get<WritingCorrection>('writing_correction', id);
  if (correction.after) return;
  const next = { ...correction, after: { resume: packet.resume, coverLetter: packet.coverLetter } };
  context.board.record(
    'writing_correction',
    next,
    'orchestrator',
    'Saved before/after user correction',
  );
  const guide = writingGuide(context);
  if (
    !guide.automatic ||
    !correction.eligible ||
    correction.retired ||
    correction.createdAt < guide.learningSince
  )
    return;
  if (correction.scope === 'resume' && correction.before.resume === packet.resume) return;
  if (correction.scope === 'coverLetter' && correction.before.coverLetter === packet.coverLetter)
    return;
  if (
    correction.before.resume === packet.resume &&
    correction.before.coverLetter === packet.coverLetter
  )
    return;
  const key = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
  const matches = context.board
    .list<WritingCorrection>('writing_correction')
    .filter(
      (c) =>
        c.after &&
        c.eligible &&
        !c.retired &&
        c.createdAt >= guide.learningSince &&
        c.scope === correction.scope &&
        key(c.preference) === key(correction.preference) &&
        ((c.scope !== 'coverLetter' && c.before.resume !== c.after.resume) ||
          (c.scope !== 'resume' && c.before.coverLetter !== c.after.coverLetter)),
    );
  if (new Set(matches.map((c) => c.cardId)).size < 2) return;
  // Explicit instructions are presented first and always govern conflicting inferred preferences.
  if (
    guide.preferences.some(
      (p) => p.scope === correction.scope && key(p.text) === key(correction.preference),
    )
  )
    return;
  addPreference(
    guide,
    correction.preference,
    correction.scope,
    'learned',
    matches.map((c) => c.id),
  );
  saveGuide(context, guide, 'orchestrator');
}
