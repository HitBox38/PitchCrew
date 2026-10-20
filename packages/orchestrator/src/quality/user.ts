import { randomUUID } from 'node:crypto';
import { qualityUserInput, type WritingCorrection, type CareerPlan } from '@pitchcrew/core';
import type { CrewContext } from '../crew/types.ts';
import { addPreference, checkGuideRevision, saveGuide } from './writing.ts';
import { currentPlan, savePlan } from './plans.ts';

export function qualityUserAction(context: CrewContext, data: unknown) {
  const input = qualityUserInput.parse(data);
  return context.board.db.transaction(() => {
    if (input.action === 'plan_create') {
      if (context.board.list<CareerPlan>('career_plan').filter((p) => p.name).length >= 20)
        throw new Error('Keep at most 20 career plans.');
      for (const cardId of input.scope.cardIds) context.board.get('card', cardId);
      const plan: CareerPlan = {
        id: randomUUID(),
        revision: 0,
        name: input.name,
        scope: input.scope,
        gaps: [],
        sourceRevision: '',
        updatedAt: new Date().toISOString(),
        coverage: 'Not analyzed yet.',
      };
      return savePlan(context, plan, 'user');
    }
    if (
      input.action === 'plan_priorities' ||
      input.action === 'plan_progress' ||
      input.action === 'plan_gap_kind' ||
      input.action === 'plan_delete'
    ) {
      const plan = currentPlan(context, input.id, input.revision);
      if (input.action === 'plan_delete') {
        context.board.record(
          'career_plan',
          { ...plan, name: '', gaps: [] },
          'user',
          'Removed career plan',
        );
        return { ok: true };
      }
      if (input.action === 'plan_priorities') {
        if (input.gapIds.some((id) => !plan.gaps.some((g) => g.id === id)))
          throw new Error('Unknown gap priority.');
        plan.gaps = plan.gaps.map((g) => ({ ...g, active: input.gapIds.includes(g.id) }));
      } else {
        const gap = plan.gaps.find((g) => g.id === input.gapId);
        if (!gap) throw new Error('Unknown career action.');
        if (input.action === 'plan_gap_kind') gap.kind = input.kind;
        else {
          gap.progress = input.progress;
          gap.progressSource = undefined;
        }
      }
      return savePlan(context, plan, 'user');
    }
    const guide = checkGuideRevision(context, input.revision);
    if (input.action === 'learning') {
      guide.automatic = input.automatic;
      guide.learningSince = new Date().toISOString();
    }
    if (input.action === 'preference') {
      if (input.id) {
        const item = guide.preferences.find((p) => p.id === input.id);
        if (!item) throw new Error('Preference not found.');
        Object.assign(item, {
          text: input.text,
          scope: input.scope,
          origin: 'explicit',
          enabled: true,
        });
      } else addPreference(guide, input.text, input.scope, 'explicit');
    }
    if (input.action === 'preference_state') {
      const item = guide.preferences.find((p) => p.id === input.id);
      if (!item) throw new Error('Preference not found.');
      if (input.operation === 'undo') {
        if (item.origin !== 'learned')
          throw new Error(
            'Undo applies to learned preferences. Edit or disable explicit preferences.',
          );
        for (const correction of context.board
          .list<WritingCorrection>('writing_correction')
          .filter((c) => item.correctionIds.includes(c.id)))
          context.board.record(
            'writing_correction',
            { ...correction, retired: true },
            'user',
            'Retired writing correction evidence',
          );
        guide.preferences = guide.preferences.filter((p) => p.id !== item.id);
      } else item.enabled = input.operation === 'enable';
    }
    if (input.action === 'proposal_decision') {
      const proposal = guide.proposals.find((p) => p.id === input.id);
      if (!proposal || proposal.status !== 'pending')
        throw new Error('Proposal is no longer pending.');
      if (input.approved && proposal.revision !== guide.revision)
        throw new Error('The guide changed after this proposal. Ask for a fresh critique.');
      proposal.status = input.approved ? 'applied' : 'rejected';
      if (input.approved) addPreference(guide, proposal.text, proposal.scope, 'explicit');
    }
    return saveGuide(context, guide, 'user');
  })();
}
