import type { CareerPlan, ProfileFile, QualitySnapshot, WritingCorrection } from '@pitchcrew/core';
import type { CrewContext } from '../crew/types.ts';
import { writingGuide } from './writing.ts';
import { planRevision } from './plans.ts';

export const qualitySnapshot = (context: CrewContext, profile: ProfileFile[]): QualitySnapshot => {
  return {
    writingGuide: writingGuide(context),
    writingCorrections: (
      context.board.db
        .prepare(
          "SELECT json_remove(json,'$.before','$.after') AS json FROM entities WHERE kind='writing_correction' ORDER BY rowid DESC LIMIT 200",
        )
        .all() as { json: string }[]
    ).map((row) => JSON.parse(row.json) as Omit<WritingCorrection, 'before' | 'after'>),
    careerPlans: context.board
      .list<CareerPlan>('career_plan')
      .filter((p) => p.name)
      .map((plan) => ({
        ...plan,
        stale: !plan.sourceRevision || planRevision(context, plan, profile) !== plan.sourceRevision,
      })),
  };
};
