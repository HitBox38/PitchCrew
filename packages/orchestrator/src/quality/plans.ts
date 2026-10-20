import { createHash } from 'node:crypto';
import type { Card, CareerPlan, CareerGap, ProfileFile, GapInput } from '@pitchcrew/core';
import type { CrewContext } from '../crew/types.ts';

export function planCards(context: CrewContext, plan: CareerPlan) {
  const cards = context.board.list<Card>('card');
  return cards.filter(
    (card) =>
      (!plan.scope.cardIds.length || plan.scope.cardIds.includes(card.id)) &&
      (!plan.scope.tag ||
        card.tags.some((tag) => tag.toLowerCase() === plan.scope.tag.toLowerCase())) &&
      (!plan.scope.title || card.title.toLowerCase().includes(plan.scope.title.toLowerCase())),
  );
}
export function planRevision(context: CrewContext, plan: CareerPlan, profile: ProfileFile[]) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        scope: plan.scope,
        cards: planCards(context, plan)
          .map((c) => ({
            id: c.id,
            title: c.title,
            tags: c.tags,
            context: c.applicationContext?.revision,
            description: c.description,
            packet: c.packet,
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        profile: [...profile].sort((a, b) => a.name.localeCompare(b.name)),
      }),
    )
    .digest('hex');
}
export function requirementTexts(card: Card) {
  const c = card.applicationContext;
  if (!c)
    return card.description
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  return [
    ...c.brief.qualifications,
    ...c.brief.responsibilities,
    ...c.brief.constraints,
    ...c.requirements.map((r) => r.question),
  ];
}
export function savePlan(context: CrewContext, plan: CareerPlan, actor: string) {
  const next = { ...plan, revision: plan.revision + 1, updatedAt: new Date().toISOString() };
  context.board.record('career_plan', next, actor, 'Updated career action plan');
  return next;
}
export function currentPlan(context: CrewContext, id: string, revision?: number) {
  const plan = context.board.get<CareerPlan>('career_plan', id);
  if (!plan.name) throw new Error('This career plan was removed.');
  if (revision !== undefined && plan.revision !== revision)
    throw new Error('The career plan changed. Refresh and try again.');
  return structuredClone(plan);
}
export function refreshPlan(
  context: CrewContext,
  plan: CareerPlan,
  gaps: GapInput[],
  profile: ProfileFile[],
  sourceRevision: string,
  coverage: string,
  actor = 'career-coach',
) {
  if (planRevision(context, plan, profile) !== sourceRevision)
    throw new Error('Source jobs or Profile changed. Read the scope again.');
  const cards = new Map(planCards(context, plan).map((c) => [c.id, c]));
  const keys = new Set<string>();
  const updated: CareerGap[] = gaps.map((gap) => {
    for (const source of gap.sources) {
      const card = cards.get(source.cardId);
      if (
        !card ||
        !(card.applicationContext
          ? requirementTexts(card).includes(source.requirement)
          : card.description.includes(source.requirement))
      )
        throw new Error('Each gap needs an exact requirement from a job in the chosen scope.');
    }
    const id = createHash('sha256')
      .update(gap.label.toLowerCase().trim())
      .digest('hex')
      .slice(0, 24);
    if (keys.has(id)) throw new Error('Merge duplicate gap findings.');
    keys.add(id);
    const previous = plan.gaps.find((g) => g.id === id);
    // A skill gap must already be confirmed by the user. New findings start as evidence gaps.
    if (gap.kind === 'skill' && previous?.kind !== 'skill')
      throw new Error(
        'Record a new gap as missing evidence; the user confirms whether a capability needs development.',
      );
    return {
      ...gap,
      kind: previous?.kind === 'skill' ? ('skill' as const) : gap.kind,
      id,
      active: previous?.active ?? false,
      progress: previous?.progress ?? ('planned' as const),
      progressSource: previous?.progressSource,
      supportedInLatestAnalysis: true,
    };
  });
  // Refresh never drops a chosen priority or a record of progress when evidence changes.
  for (const gap of plan.gaps)
    if (!keys.has(gap.id) && (gap.active || gap.progress !== 'planned'))
      updated.push({ ...gap, supportedInLatestAnalysis: false });
  return savePlan(context, { ...plan, gaps: updated, sourceRevision, coverage }, actor);
}
